-- 파티모아 초기 스키마. 사양서 5절.
--
-- 원칙 두 가지가 이 파일 전체를 지배한다.
--   1) 파생값(잔여·성별 잔여·차수 판매량)은 저장하지 않는다. 집계한다.
--      저장하면 취소·환불에서 반드시 어긋난다.
--   2) 예매 생성은 트랜잭션 안에서 행을 잠그고 재확인한다.
--      클라이언트가 계산한 잔여는 믿지 않는다.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────── 크루

create table crews (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  bio text,
  avatar_url text,
  instagram text,
  -- 대표 계정. 아직 가입 전이면 비어 있고, 그때는 crew_members.email 로
  -- 권한이 간다 — 크루를 먼저 등록하고 초대하는 순서가 되게
  owner_id uuid references auth.users,
  created_at timestamptz default now()
);

create table crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crews on delete cascade not null,
  user_id uuid references auth.users,
  display_name text not null,
  invite_code text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  unique (crew_id, invite_code)
);

-- 초대 코드는 대문자로만 저장한다. 게스트가 소문자로 쳐도 맞게 하려면
-- 저장 시점에 맞춰 두는 게 조회마다 upper() 를 거는 것보다 싸다
create or replace function normalize_invite_code() returns trigger
language plpgsql as $fn$
begin
  new.invite_code := upper(trim(new.invite_code));
  return new;
end $fn$;

create trigger crew_members_normalize
  before insert or update on crew_members
  for each row execute function normalize_invite_code();

-- ─────────────────────────────────────────── 파티

create table events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crews on delete cascade not null,
  slug text unique not null,
  title text not null,
  subtitle text,
  description text,
  cover_url text,
  venue_name text not null,
  area text not null,
  address text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null check (capacity > 0),
  gender_balanced boolean not null default true,
  male_price_multiplier numeric not null default 1.25,
  solo_friendly boolean not null default false,
  genres text[] not null default '{}',
  categories text[] not null default '{}',
  list_price int not null,
  bank_account text,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'done')),
  created_at timestamptz default now()
);

create index events_status_starts_idx on events (status, starts_at);
create index events_crew_idx on events (crew_id);

create table ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  name text not null,
  note text,
  price int not null check (price >= 0),
  -- 남성가. 비우면 events.male_price_multiplier 로 계산한다.
  -- 실제 크루는 계수가 아니라 두 가격을 따로 정한다 (1차 39/49 · 3차 59/69)
  male_price int check (male_price is null or male_price >= 0),
  capacity int not null check (capacity > 0),
  sort_order int not null
);

create index ticket_tiers_event_idx on ticket_tiers (event_id, sort_order);

create table lineups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  artist_name text not null,
  starts_at time not null,
  sort_order int not null
);

create index lineups_event_idx on lineups (event_id, sort_order);

-- ─────────────────────────────────────────── 예매

-- 예매번호는 전역 시퀀스 하나에서 뽑는다. 이벤트별로 나누면 같은 번호가
-- 여러 행사에 생겨 현장에서 헷갈린다
create sequence booking_code_seq start 1;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  event_id uuid references events on delete cascade not null,
  tier_id uuid references ticket_tiers not null,
  user_id uuid references auth.users,
  name text not null,
  phone text not null,
  gender text not null check (gender in ('F', 'M')),
  quantity int not null check (quantity between 1 and 4),
  amount int not null check (amount >= 0),
  invite_code text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'checked_in', 'cancelled')),
  paid_at timestamptz,
  checked_in_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index bookings_event_status_idx on bookings (event_id, status);
create index bookings_code_idx on bookings (code);
create index bookings_phone_idx on bookings (phone);
create index bookings_expiry_idx on bookings (status, expires_at)
  where status = 'pending';

-- ─────────────────────────────────────────── 찜 · 팔로우

create table favorites (
  user_id uuid references auth.users not null,
  event_id uuid references events on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

create table crew_follows (
  user_id uuid references auth.users not null,
  crew_id uuid references crews on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, crew_id)
);

-- ─────────────────────────────────────────── 집계 뷰
--
-- 취소가 아닌 모든 예매(pending 포함)가 자리를 차지한다.
-- 미입금이라고 자리를 비워 두면 이중 판매가 난다 — 24시간 뒤 자동 취소가
-- 그 자리를 되돌린다.

create view event_stats as
select
  e.id as event_id,
  e.capacity,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'), 0)::int as booked,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled' and b.gender = 'F'), 0)::int as booked_f,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled' and b.gender = 'M'), 0)::int as booked_m,
  coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0)::bigint as revenue_paid,
  coalesce(sum(b.amount) filter (where b.status <> 'cancelled'), 0)::bigint as revenue_total
from events e
left join bookings b on b.event_id = e.id
group by e.id;

create view tier_stats as
select
  t.id as tier_id,
  t.event_id,
  t.capacity,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'), 0)::int as sold
from ticket_tiers t
left join bookings b on b.tier_id = t.id
group by t.id;

-- ─────────────────────────────────────────── 예매 생성 RPC
--
-- **여기가 이 제품의 심장이다.** 동시에 두 명이 마지막 자리를 눌러도
-- 하나만 성공해야 한다.
--
-- 잠금 순서: events 행을 먼저 잠근다. 한 이벤트의 예매가 전부 이 행에서
-- 직렬화되므로 정원·성별·차수를 순서 걱정 없이 한 번에 볼 수 있다.
-- 차수 행부터 잠그면 이벤트 정원 검사에 경합이 남는다.
--
-- 에러는 'CODE:잔여' 형태로 던진다. 앱이 잔여 수를 그대로 보여 준다.

-- 이미 깔린 DB 에도 남성가 컬럼을 넣는다. create table if not exists 는
-- 표가 있으면 통째로 건너뛰어서 컬럼이 안 생긴다
alter table ticket_tiers add column if not exists male_price int;
do $$ begin
  alter table ticket_tiers add constraint ticket_tiers_male_price_check
    check (male_price is null or male_price >= 0);
exception when duplicate_object then null;
end $$;

-- **가격의 단일 진실.** lib/rules.ts 의 priceFor 는 이걸 화면용으로 옮겨
-- 적은 사본이고, 실제로 돈을 정하는 건 여기다
create or replace function tier_price(p_tier ticket_tiers, p_event events, p_gender text)
returns int language sql immutable as $$
  select case
    when p_gender <> 'M' then p_tier.price
    when p_tier.male_price is not null then p_tier.male_price
    else (round(p_tier.price * p_event.male_price_multiplier / 1000.0) * 1000)::int
  end;
$$;

create or replace function create_booking(
  p_event_id uuid,
  p_tier_id uuid,
  p_name text,
  p_phone text,
  p_gender text,
  p_quantity int,
  p_invite_code text default null
) returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_event events;
  v_tier ticket_tiers;
  v_booked int;
  v_booked_g int;
  v_tier_sold int;
  v_gender_cap int;
  v_price int;
  v_amount int;
  v_invite text;
  v_row bookings;
begin
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;
  if p_quantity < 1 or p_quantity > 4 then
    raise exception 'BAD_QUANTITY' using errcode = 'P0001';
  end if;

  -- 이 행사의 모든 예매를 여기서 직렬화한다
  select * into v_event from events where id = p_event_id for update;
  if not found or v_event.status <> 'open' then
    raise exception 'EVENT_NOT_OPEN' using errcode = 'P0001';
  end if;

  select * into v_tier
  from ticket_tiers where id = p_tier_id and event_id = p_event_id;
  if not found then
    raise exception 'TIER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 잠근 뒤 다시 센다. 클라이언트가 보낸 잔여는 이미 낡았다
  select
    coalesce(sum(quantity) filter (where status <> 'cancelled'), 0),
    coalesce(sum(quantity) filter (where status <> 'cancelled' and gender = p_gender), 0),
    coalesce(sum(quantity) filter (where status <> 'cancelled' and tier_id = p_tier_id), 0)
  into v_booked, v_booked_g, v_tier_sold
  from bookings where event_id = p_event_id;

  if v_booked + p_quantity > v_event.capacity then
    raise exception 'CAPACITY_EXCEEDED:%', v_event.capacity - v_booked
      using errcode = 'P0001';
  end if;

  if v_event.gender_balanced then
    v_gender_cap := floor(v_event.capacity / 2.0);
    if v_booked_g + p_quantity > v_gender_cap then
      raise exception 'GENDER_CAPACITY_EXCEEDED:%', v_gender_cap - v_booked_g
        using errcode = 'P0001';
    end if;
  end if;

  if v_tier_sold + p_quantity > v_tier.capacity then
    raise exception 'TIER_SOLD_OUT:%', v_tier.capacity - v_tier_sold
      using errcode = 'P0001';
  end if;

  -- 금액도 서버가 정한다. 클라이언트가 보낸 금액은 쓰지 않는다.
  -- 차수에 남성가가 적혀 있으면 그걸 쓰고, 없으면 계수로 계산한다
  v_price := tier_price(v_tier, v_event, p_gender);
  v_amount := v_price * p_quantity;

  v_invite := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  if v_invite is not null and not exists (
    select 1 from crew_members
    where crew_id = v_event.crew_id and invite_code = v_invite
  ) then
    v_invite := null;   -- 없는 코드는 조용히 버린다. 예매 자체를 막지 않는다
  end if;

  insert into bookings (
    code, event_id, tier_id, user_id, name, phone, gender,
    quantity, amount, invite_code, expires_at
  ) values (
    'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
    p_event_id, p_tier_id, auth.uid(), trim(p_name), trim(p_phone), p_gender,
    p_quantity, v_amount, v_invite, now() + interval '24 hours'
  ) returning * into v_row;

  return v_row;
end $fn$;

revoke all on function create_booking from public;
grant execute on function create_booking to anon, authenticated;

-- ─────────────────────────────────────────── 자동 취소
--
-- 카운트를 되돌리는 코드가 따로 없다. 잔여를 저장하지 않고 집계하므로
-- status 를 cancelled 로 바꾸는 것만으로 정원·성별·차수가 함께 돌아온다.
-- 이것이 파생값을 저장하지 않는 진짜 이유다.

create or replace function expire_unpaid_bookings()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count int;
begin
  with gone as (
    update bookings set status = 'cancelled'
    where status = 'pending' and expires_at < now()
    returning 1
  )
  select count(*)::int into v_count from gone;
  return v_count;
end $fn$;

revoke all on function expire_unpaid_bookings from public;
