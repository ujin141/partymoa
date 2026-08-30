-- ═══════════════════════════════════════════════════════════════════
--  파티모아 — 한 번에 다 하는 판
--
--  Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
--  스키마 · RLS · 예매 함수 · 크론 · 실시간 · 운영자 · 첫 행사까지 다 든다.
--
--  **여러 번 돌려도 안 깨진다.** 이미 만들어진 건 건너뛴다.
--  중간에 끊겼으면 그냥 다시 돌리면 된다.
--
--  계정을 아직 안 만들었어도 스키마는 들어간다. 계정을 만든 뒤
--  이 파일을 다시 돌리면 그때 행사 데이터가 채워진다.
--
--  ┌───────────────────────────────────────────────────────────────┐
--  │  크루 계정도 이 파일이 만든다. 대시보드에서 따로 만들 것 없다. │
--  │  아래 email · pw 를 정하고 돌리면 그 계정으로 /crew/login 에   │
--  │  바로 들어갈 수 있다.                                         │
--  └───────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════


-- ███████████████████████████████████████████████████████████████████
-- ██  여기 네 줄만 고치세요                                        ██
-- ███████████████████████████████████████████████████████████████████

create temp table if not exists _cfg (k text primary key, v text);
truncate _cfg;
insert into _cfg (k, v) values
  ('email', 'ujin141@naver.com'),                      -- ⬛ 크루 로그인 이메일
  ('pw',    'partymoa2026'),                           -- ⬛ 크루 로그인 비밀번호
  ('bank',  '농협 352-0860-4459-03 (송우진)'),          -- ⬛ 입금 계좌
  ('cover', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=70'),  -- ⬛ 커버 사진
  ('crew',  'BLACKOUT'),                               -- ⬛ 크루 이름
  ('gmail', ''),                                       -- ⬛ 구글 로그인에 쓸 주소
                                                       --    비워 두면 구글로 들어가도
                                                       --    크루 스태프가 아니다
  ('status','draft');                                  -- ⬛ draft = 나만 봄
                                                       --    open  = 손님에게 보임

-- ███████████████████████████████████████████████████████████████████
-- ██  아래는 손댈 것 없음                                          ██
-- ███████████████████████████████████████████████████████████████████


-- ─── 20260826000100_init.sql ───────────────────────
-- 파티모아 초기 스키마. 사양서 5절.
--
-- 원칙 두 가지가 이 파일 전체를 지배한다.
--   1) 파생값(잔여·성별 잔여·차수 판매량)은 저장하지 않는다. 집계한다.
--      저장하면 취소·환불에서 반드시 어긋난다.
--   2) 예매 생성은 트랜잭션 안에서 행을 잠그고 재확인한다.
--      클라이언트가 계산한 잔여는 믿지 않는다.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────── 크루

create table if not exists crews (
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

create table if not exists crew_members (
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

drop trigger if exists crew_members_normalize on crew_members;
create trigger crew_members_normalize
  before insert or update on crew_members
  for each row execute function normalize_invite_code();

-- ─────────────────────────────────────────── 파티

create table if not exists events (
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

create index if not exists events_status_starts_idx on events (status, starts_at);
create index if not exists events_crew_idx on events (crew_id);

create table if not exists ticket_tiers (
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

create index if not exists ticket_tiers_event_idx on ticket_tiers (event_id, sort_order);

create table if not exists lineups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  artist_name text not null,
  starts_at time not null,
  sort_order int not null
);

create index if not exists lineups_event_idx on lineups (event_id, sort_order);

-- ─────────────────────────────────────────── 예매

-- 예매번호는 전역 시퀀스 하나에서 뽑는다. 이벤트별로 나누면 같은 번호가
-- 여러 행사에 생겨 현장에서 헷갈린다
create sequence if not exists booking_code_seq start 1;

create table if not exists bookings (
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

create index if not exists bookings_event_status_idx on bookings (event_id, status);
create index if not exists bookings_code_idx on bookings (code);
create index if not exists bookings_phone_idx on bookings (phone);
create index if not exists bookings_expiry_idx on bookings (status, expires_at)
  where status = 'pending';

-- ─────────────────────────────────────────── 찜 · 팔로우

create table if not exists favorites (
  user_id uuid references auth.users not null,
  event_id uuid references events on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

create table if not exists crew_follows (
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

drop view if exists event_stats cascade;
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

drop view if exists tier_stats cascade;
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
-- 이미 깔린 DB 도 풀어 준다. 대표가 가입 전이어도 크루를 등록할 수 있어야 한다
alter table crews alter column owner_id drop not null;

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

  -- **초대를 먼저 확인한다.** 금액이 초대 여부에 달려 있기 때문이다
  v_invite := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  if v_invite is not null and not exists (
    select 1 from crew_members
    where crew_id = v_event.crew_id and invite_code = v_invite
  ) then
    v_invite := null;   -- 없는 코드는 조용히 버린다. 예매 자체를 막지 않는다
  end if;

  -- 금액도 서버가 정한다. 클라이언트가 보낸 금액은 쓰지 않는다.
  -- 유효한 초대가 있으면 게스트가, 없으면 차수 가격(남성가 포함)
  v_price := tier_price(v_tier, v_event, p_gender, v_invite is not null);
  v_amount := v_price * p_quantity;

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

-- ─── 20260826000200_rls.sql ────────────────────────
-- RLS. 사양서 5절 마지막 문단.
--
-- 기본은 전부 잠그고 필요한 것만 연다. 특히 bookings 는 **직접 insert 를
-- 허용하지 않는다** — 예매는 create_booking RPC 로만 들어온다. 정책으로
-- insert 를 열면 정원 검사를 건너뛰는 길이 생긴다.

alter table crews enable row level security;
alter table crew_members enable row level security;
alter table events enable row level security;
alter table ticket_tiers enable row level security;
alter table lineups enable row level security;
alter table bookings enable row level security;
alter table favorites enable row level security;
alter table crew_follows enable row level security;

-- ─────────────────────────────────────────── 헬퍼
--
-- 정책 안에서 crew_members 를 직접 조회하면 그 테이블의 정책이 다시 걸려
-- 무한 재귀가 난다. security definer 함수로 한 번 빠져나간다.

create or replace function is_crew_staff(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from crews where id = p_crew_id and owner_id = auth.uid()
  ) or exists (
    select 1 from crew_members
    where crew_id = p_crew_id and user_id = auth.uid()
  );
$fn$;

create or replace function is_event_staff(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from events e
    where e.id = p_event_id and is_crew_staff(e.crew_id)
  );
$fn$;

-- ─────────────────────────────────────────── 크루

drop policy if exists crews_read on crews;
create policy crews_read on crews
  for select using (true);

drop policy if exists crews_insert on crews;
create policy crews_insert on crews
  for insert with check (owner_id = auth.uid());

drop policy if exists crews_write on crews;
create policy crews_write on crews
  for update using (owner_id = auth.uid());

drop policy if exists crews_delete on crews;
create policy crews_delete on crews
  for delete using (owner_id = auth.uid());

-- 멤버 목록은 공개하지 않는다. 초대 코드가 정산 근거라 노출되면 곤란하다
drop policy if exists crew_members_read on crew_members;
create policy crew_members_read on crew_members
  for select using (is_crew_staff(crew_id));

drop policy if exists crew_members_write on crew_members;
create policy crew_members_write on crew_members
  for all using (
    exists (select 1 from crews where id = crew_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from crews where id = crew_id and owner_id = auth.uid())
  );

-- ─────────────────────────────────────────── 파티

drop policy if exists events_read_open on events;
-- draft 만 가린다. 끝난 파티는 기록으로 남기 때문에 열려 있어야 한다 --
-- open 하나만 걸어 두면 행사를 done 으로 바꾸는 순간 페이지가 404 가 된다
create policy events_read_open on events
  for select using (status <> 'draft' or is_crew_staff(crew_id));

drop policy if exists events_write on events;
create policy events_write on events
  for all using (is_crew_staff(crew_id)) with check (is_crew_staff(crew_id));

drop policy if exists tiers_read on ticket_tiers;
create policy tiers_read on ticket_tiers
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status = 'open' or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists tiers_write on ticket_tiers;
create policy tiers_write on ticket_tiers
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

drop policy if exists lineups_read on lineups;
create policy lineups_read on lineups
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status = 'open' or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists lineups_write on lineups;
create policy lineups_write on lineups
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─────────────────────────────────────────── 예매
--
-- insert 정책이 **없다.** 일부러 그렇다. create_booking(security definer)
-- 만이 행을 만든다.

drop policy if exists bookings_read_own on bookings;
create policy bookings_read_own on bookings
  for select using (
    (user_id is not null and user_id = auth.uid()) or is_event_staff(event_id)
  );

drop policy if exists bookings_update_staff on bookings;
create policy bookings_update_staff on bookings
  for update using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─────────────────────────────────────────── 찜 · 팔로우

drop policy if exists favorites_own on favorites;
create policy favorites_own on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists follows_own on crew_follows;
create policy follows_own on crew_follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 집계 뷰
--
-- **일부러 security invoker 를 켜지 않는다.** 켜면 anon 이 event_stats 를
-- 읽으려고 bookings 전체 읽기 권한을 가져야 한다 — 개인 예매가 새어 나간다.
-- 뷰는 소유자 권한으로 돌고 **합계만** 돌려준다. "21자리 남았어요" 는
-- 어차피 공개 정보다.

grant select on event_stats to anon, authenticated;
grant select on tier_stats to anon, authenticated;

-- ─── 20260826000300_expenses.sql ───────────────────
-- 정산 지출. 사양서 6절의 "대관료 (크루 입력)" 이 들어갈 자리가
-- 5절 스키마에 없었다. 행 단위로 두면 대관료·홍보비 말고 다른 항목이
-- 생겨도 스키마를 안 고친다.

create table if not exists event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  label text not null,
  amount int not null check (amount >= 0),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists event_expenses_event_idx on event_expenses (event_id, sort_order);

alter table event_expenses enable row level security;

drop policy if exists expenses_staff on event_expenses;
create policy expenses_staff on event_expenses
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─── 20260826000400_cron.sql ───────────────────────
-- 미입금 자동 취소. 사양서 3-3.
--
-- Edge Function 을 쓰지 않고 pg_cron 안에서 끝낸다. 취소는 DB 안의
-- update 한 줄이고, 정원 반환은 뷰가 알아서 한다 — 네트워크를 한 번
-- 나갔다 오는 구조를 만들면 실패 지점만 늘어난다.

create extension if not exists pg_cron;

do $cr$
begin
  perform cron.unschedule('expire-unpaid-bookings')
  where exists (select 1 from cron.job where jobname = 'expire-unpaid-bookings');
  perform cron.schedule('expire-unpaid-bookings', '*/10 * * * *',
                        $cron$ select public.expire_unpaid_bookings(); $cron$);
end $cr$;

-- ─── 20260826000500_find_booking.sql ───────────────
-- 예매번호 + 연락처로 내 티켓 찾기.
--
-- 로그인 없이 예매를 받으므로(첫 목표가 "링크로 들어와 예매"다) 기기를
-- 바꾸거나 쿠키가 지워지면 티켓을 못 찾는다. 둘 다 맞아야만 한 건을
-- 돌려주는 함수를 둔다 — 번호만으로는 남의 티켓을 못 본다.

create or replace function find_booking(p_code text, p_phone text)
returns bookings
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_row bookings;
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 8 then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;

  select * into v_row from bookings
  where upper(trim(code)) = upper(trim(p_code))
    and regexp_replace(phone, '\D', '', 'g') = v_digits
    and status <> 'cancelled';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_row;
end $fn$;

revoke all on function find_booking from public;
grant execute on function find_booking to anon, authenticated;

-- 찾은 티켓을 지금 세션에 붙인다. 다음부터는 목록에 그냥 뜬다
create or replace function claim_booking(p_code text, p_phone text)
returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row bookings;
begin
  v_row := find_booking(p_code, p_phone);
  if auth.uid() is null then
    return v_row;
  end if;
  update bookings set user_id = auth.uid()
  where id = v_row.id and user_id is null
  returning * into v_row;
  if v_row.id is null then
    v_row := find_booking(p_code, p_phone);
  end if;
  return v_row;
end $fn$;

revoke all on function claim_booking from public;
grant execute on function claim_booking to anon, authenticated;

-- ─── 20260826000600_community.sql ──────────────────
-- 커뮤니티 자유 게시판.
--
-- 글쓰기는 RPC 로만 들어온다. insert 정책을 열면 닉네임·본문 길이 검사와
-- 도배 방지를 우회하는 길이 생긴다 — 예매와 같은 원칙이다.
--
-- user_id 가 null 일 수 있다. 익명 로그인을 안 켠 프로젝트에서도 글은
-- 써지게 하되, 그런 글은 본인이 지울 수 없다(누가 본인인지 알 수 없으므로).

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  nickname text not null,
  body text not null,
  event_id uuid references events on delete set null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists posts_live_idx on posts (created_at desc) where deleted_at is null;
create index if not exists posts_user_idx on posts (user_id, created_at desc);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users,
  nickname text not null,
  body text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists post_comments_post_idx on post_comments (post_id, created_at);

-- 목록에서 댓글 수를 세려고 매번 조인하지 않는다
drop view if exists post_list cascade;
create view post_list as
select
  p.id, p.user_id, p.nickname, p.body, p.event_id, p.created_at,
  coalesce(c.n, 0)::int as comment_count,
  e.title as event_title,
  e.slug as event_slug
from posts p
left join events e on e.id = p.event_id
left join (
  select post_id, count(*) as n from post_comments
  where deleted_at is null group by post_id
) c on c.post_id = p.id
where p.deleted_at is null;

alter table posts enable row level security;
alter table post_comments enable row level security;

drop policy if exists posts_read on posts;
create policy posts_read on posts
  for select using (deleted_at is null);

drop policy if exists posts_own_write on posts;
create policy posts_own_write on posts
  for update using (user_id is not null and user_id = auth.uid())
  with check (user_id is not null and user_id = auth.uid());

drop policy if exists comments_read on post_comments;
create policy comments_read on post_comments
  for select using (deleted_at is null);

drop policy if exists comments_own_write on post_comments;
create policy comments_own_write on post_comments
  for update using (user_id is not null and user_id = auth.uid())
  with check (user_id is not null and user_id = auth.uid());

grant select on post_list to anon, authenticated;

-- ─────────────────────────────────────────── 쓰기

create or replace function create_post(
  p_nickname text,
  p_body text,
  p_event_id uuid default null
) returns posts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nick text;
  v_body text;
  v_row posts;
begin
  v_nick := nullif(trim(p_nickname), '');
  v_body := nullif(trim(p_body), '');
  if v_nick is null or length(v_nick) > 20 then
    raise exception 'BAD_NICKNAME' using errcode = 'P0001';
  end if;
  if v_body is null or length(v_body) > 2000 then
    raise exception 'BAD_BODY' using errcode = 'P0001';
  end if;

  -- 도배 방지. 같은 글을 연달아 올리는 걸 막는다
  if exists (
    select 1 from posts
    where nickname = v_nick and body = v_body
      and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'DUPLICATE' using errcode = 'P0001';
  end if;

  insert into posts (user_id, nickname, body, event_id)
  values (auth.uid(), v_nick, v_body, p_event_id)
  returning * into v_row;
  return v_row;
end $fn$;

create or replace function create_comment(
  p_post_id uuid,
  p_nickname text,
  p_body text
) returns post_comments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nick text;
  v_body text;
  v_row post_comments;
begin
  v_nick := nullif(trim(p_nickname), '');
  v_body := nullif(trim(p_body), '');
  if v_nick is null or length(v_nick) > 20 then
    raise exception 'BAD_NICKNAME' using errcode = 'P0001';
  end if;
  if v_body is null or length(v_body) > 1000 then
    raise exception 'BAD_BODY' using errcode = 'P0001';
  end if;
  if not exists (select 1 from posts where id = p_post_id and deleted_at is null) then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into post_comments (post_id, user_id, nickname, body)
  values (p_post_id, auth.uid(), v_nick, v_body)
  returning * into v_row;
  return v_row;
end $fn$;

-- 지우기는 본인만. 행을 없애지 않고 표시만 한다 — 댓글이 붕 뜨지 않게
create or replace function delete_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;
  update posts set deleted_at = now()
  where id = p_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
end $fn$;

create or replace function delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;
  update post_comments set deleted_at = now()
  where id = p_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
end $fn$;

revoke all on function create_post, create_comment, delete_post, delete_comment from public;
grant execute on function create_post, create_comment, delete_post, delete_comment
  to anon, authenticated;

-- ─── 20260826000700_realtime.sql ───────────────────
-- 입구에 스태프가 둘 이상 서면 서로가 처리한 걸 봐야 한다.
-- 폴링을 돌리면 행사장 와이파이에서 배터리와 대역폭을 먹는다.
--
-- **RLS 는 그대로 적용된다.** 크루 스태프만 그 행사의 bookings 를 읽을 수
-- 있으므로 손님 예매가 남에게 흘러가지 않는다.

do $rt$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table bookings;
  end if;
end $rt$;

-- ─── 20260826000800_admin.sql ──────────────────────
-- 플랫폼 운영자.
--
-- 크루 스태프(is_crew_staff)와 다른 층이다. 크루는 자기 행사만 보고,
-- 운영자는 전부 본다 — 수수료 집계와 크루 온보딩이 운영자 일이다.
--
-- 역할을 auth 메타데이터에 넣지 않고 테이블로 둔다. 메타데이터는 클라이언트
-- 토큰에 실려 나가고, 실수로 수정 가능한 자리에 권한을 두면 안 된다.

create table if not exists app_admins (
  user_id uuid primary key references auth.users on delete cascade,
  note text,
  created_at timestamptz default now()
);

alter table app_admins enable row level security;

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from app_admins where user_id = auth.uid());
$fn$;

-- 본인이 운영자인지만 확인할 수 있다. 명단은 못 본다
drop policy if exists admins_self on app_admins;
create policy admins_self on app_admins
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────── 운영자 읽기 권한
--
-- 기존 정책을 고치지 않고 정책을 더한다. 여러 정책은 OR 로 묶이므로
-- 크루 정책은 그대로 두고 운영자 통로만 하나 더 낸다.

drop policy if exists events_admin_read on events;
create policy events_admin_read on events for select using (is_app_admin());
drop policy if exists bookings_admin_read on bookings;
create policy bookings_admin_read on bookings for select using (is_app_admin());
drop policy if exists tiers_admin_read on ticket_tiers;
create policy tiers_admin_read on ticket_tiers for select using (is_app_admin());
drop policy if exists crew_members_admin_read on crew_members;
create policy crew_members_admin_read on crew_members
  for select using (is_app_admin());
drop policy if exists expenses_admin_read on event_expenses;
create policy expenses_admin_read on event_expenses
  for select using (is_app_admin());
drop policy if exists posts_admin_all on posts;
create policy posts_admin_all on posts
  for all using (is_app_admin()) with check (is_app_admin());
drop policy if exists comments_admin_all on post_comments;
create policy comments_admin_all on post_comments
  for all using (is_app_admin()) with check (is_app_admin());
drop policy if exists crews_admin_write on crews;
create policy crews_admin_write on crews
  for all using (is_app_admin()) with check (is_app_admin());

-- 크루를 등록할 때 대표 멤버 한 줄을 같이 넣는다. crew_members_write 는
-- "그 크루의 owner" 만 통과시키는데, 갓 만든 크루는 owner 가 비어 있거나
-- 운영자 본인이 아니라 막힌다
drop policy if exists crew_members_admin_write on crew_members;
create policy crew_members_admin_write on crew_members
  for all using (is_app_admin()) with check (is_app_admin());

-- ─────────────────────────────────────────── 플랫폼 집계
--
-- 수수료는 **입금 완료된 건에만** 매긴다(사양서 3-5). 예정 매출에 수수료를
-- 걸면 미입금 자동 취소 때마다 장부가 흔들린다.
--
-- **security_invoker 를 켠다.** 끄면 뷰가 소유자 권한으로 돌아 RLS 를
-- 건너뛰고, 그 상태로 authenticated 에게 열면 아무나 로그인해서 남의 크루
-- 매출을 통째로 읽는다. event_stats 와 다르다 — 그쪽은 "몇 자리 남았다" 라
-- 공개해도 되지만 여기는 돈이다.

drop view if exists platform_stats cascade;
create view platform_stats
with (security_invoker = on)
as
select
  e.id as event_id,
  e.crew_id,
  e.title,
  e.starts_at,
  e.status,
  c.name as crew_name,
  e.capacity,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'), 0)::int as booked,
  coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0)::bigint as revenue_paid,
  round(
      -- lib/rules.ts 의 FEE_RATE 와 같아야 한다
    coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0) * 0.10
  )::bigint as fee
from events e
join crews c on c.id = e.crew_id
left join bookings b on b.event_id = e.id
group by e.id, c.name;

revoke all on platform_stats from anon;
grant select on platform_stats to authenticated;

-- 크루 신청.
--
-- 지금은 "크루로 전환하기" 를 누르면 크루 로그인으로 보낸다. 크루로
-- 등록된 사람만 들어가는 문이라, 등록이 안 된 사람은 그냥 막힌다.
-- 등록 요청을 받을 자리가 없어서 인스타 DM 으로 오라고 적어 뒀는데,
-- 그러면 무엇을 물어봐야 하는지도 매번 다시 정해야 한다.
--
-- 받을 것을 표로 못 박는다. 승인하면 그대로 크루가 된다.

create table if not exists crew_applications (
  id uuid primary key default gen_random_uuid(),

  -- 크루
  crew_name  text not null,
  slug       text not null,
  instagram  text,
  bio        text,

  -- 연락 — 승인 여부를 알려야 하고, 사고가 나면 여기로 건다
  contact_name  text not null,
  contact_phone text not null,
  email         text not null,

  -- 심사에 실제로 쓰는 것. 없으면 승인 기준이 사람 기분이 된다
  venue      text,   -- 주로 어디서 여는가
  scale      text,   -- 보통 몇 명 규모인가
  history    text,   -- 지금까지 연 파티
  note       text,

  user_id uuid references auth.users on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_at   timestamptz,
  -- 승인해서 만들어진 크루. 신청과 크루를 이어 둬야 나중에 추적된다
  crew_id uuid references crews on delete set null,

  created_at timestamptz default now()
);

create index if not exists crew_applications_status_idx
  on crew_applications (status, created_at desc);

alter table crew_applications enable row level security;

-- 본인 신청만 본다. 남의 신청서에는 연락처가 들어 있다
drop policy if exists crew_apps_own_read on crew_applications;
create policy crew_apps_own_read on crew_applications
  for select using (user_id = auth.uid() or is_app_admin());

-- **로그인한 사람만 낸다.** 익명 세션으로 받으면 승인해도 그 계정에
-- 권한을 이어 줄 수가 없고, 장난 신청을 막을 방법도 없다
drop policy if exists crew_apps_insert on crew_applications;
create policy crew_apps_insert on crew_applications
  for insert with check (
    user_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- 심사는 운영자만
drop policy if exists crew_apps_admin_write on crew_applications;
create policy crew_apps_admin_write on crew_applications
  for update using (is_app_admin()) with check (is_app_admin());

-- 프로필과 후기.
--
-- ── 프로필
-- 지금 마이 화면은 이메일 주소를 그대로 띄운다. 남한테 보여 줄 이름이
-- 없어서 커뮤니티에 글을 쓸 때마다 닉네임을 다시 친다.
--
-- **이름과 연락처를 같이 둔다.** 예매할 때마다 같은 값을 또 적는 게
-- 제일 귀찮은 일이고, 오타가 나면 입금자명이 안 맞아 대조가 깨진다.
--
-- ── 후기
-- 예매한 사람만 쓴다. 안 온 사람이 쓰는 후기는 다음 파티를 고르는 데
-- 도움이 안 되고, 경쟁 크루가 깎는 통로가 된다.
--
-- **파티가 시작한 뒤에만 쓴다.** 열리지도 않은 파티의 후기는 그냥 홍보다.

create table if not exists profiles (
  user_id  uuid primary key references auth.users on delete cascade,
  nickname text,
  -- 예매 폼에 미리 채운다. 실명과 연락처는 입금 대조·현장 확인에 쓰인다
  real_name text,
  phone     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

-- **본인 것만.** 닉네임은 글에 이미 박혀 나가므로 표를 열 이유가 없다
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 취향
--
-- 처음 들어온 사람에게 무엇을 먼저 보여 줄지 정할 근거가 없었다.
-- 지역과 카테고리만 받는다 — 더 물으면 시작 화면이 길어지고, 길면
-- 건너뛴다. 비어 있으면 예전처럼 전체를 보여 준다.
alter table profiles add column if not exists areas      text[] not null default '{}';
alter table profiles add column if not exists categories text[] not null default '{}';
-- 시작 화면을 봤는지. 취향을 안 골라도 다시 안 띄운다
alter table profiles add column if not exists onboarded_at timestamptz;

-- ─────────────────────────────────────────── 취향 집계
--
-- 운영자가 "사람들이 뭘 좋아하는가" 를 봐야 다음에 뭘 밀지 정한다.
--
-- **그런데 프로필은 본인만 볼 수 있다**(profiles_own). 운영자에게 표를
-- 통째로 열면 이름·연락처까지 같이 열린다. 필요한 건 합계뿐이므로
-- 합계만 내주는 함수를 둔다 — 누가 뭘 골랐는지는 여기서도 안 나온다.
create or replace function preference_stats()
returns table (kind text, value text, people int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
    select '지역'::text, a::text, count(*)::int
    from profiles p, unnest(p.areas) a
    group by a
    union all
    select '분위기'::text, c::text, count(*)::int
    from profiles p, unnest(p.categories) c
    group by c
    order by 1, 3 desc;
end $fn$;

revoke all on function preference_stats from public, anon;
grant execute on function preference_stats to authenticated;

-- 몇 명이 시작 화면을 봤고 몇 명이 실제로 골랐나
create or replace function preference_summary()
returns table (people int, onboarded int, picked int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
    select count(*)::int,
           count(*) filter (where onboarded_at is not null)::int,
           count(*) filter (
             where cardinality(areas) > 0 or cardinality(categories) > 0
           )::int
    from profiles;
end $fn$;

revoke all on function preference_summary from public, anon;
grant execute on function preference_summary to authenticated;

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  user_id  uuid references auth.users on delete cascade not null,
  rating   int not null check (rating between 1 and 5),
  body     text not null,
  nickname text not null,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  -- 한 사람이 한 파티에 하나. 여러 개면 평점이 무너진다
  unique (event_id, user_id)
);

create index if not exists reviews_event_idx
  on reviews (event_id, created_at desc);

alter table reviews enable row level security;

/**
 * 이 사람이 그 파티 후기를 쓸 자격이 있나.
 *
 * 취소가 아닌 예매가 본인 계정에 붙어 있어야 하고, 파티가 시작한 뒤여야
 * 한다. 익명 세션으로 예매했다가 나중에 로그인한 경우는 예매가 옛
 * user_id 에 남아 안 잡힌다 — 그건 티켓 찾기로 이어 붙인 뒤에 쓴다.
 */
create or replace function can_review(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from bookings b
    join events e on e.id = b.event_id
    where b.event_id = p_event
      and b.user_id = auth.uid()
      and b.status <> 'cancelled'
      and e.starts_at <= now()
  );
$fn$;

-- 후기는 누구나 읽는다. 파티를 고르는 근거라 로그인 전에도 보여야 한다
drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews
  for select using (deleted_at is null or is_app_admin());

drop policy if exists reviews_write on reviews;
create policy reviews_write on reviews
  for insert with check (user_id = auth.uid() and can_review(event_id));

drop policy if exists reviews_own_edit on reviews;
create policy reviews_own_edit on reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 운영자는 가린다. 지우지는 않는다 — 무엇을 가렸는지 남아야 한다
drop policy if exists reviews_admin on reviews;
create policy reviews_admin on reviews
  for all using (is_app_admin()) with check (is_app_admin());

-- 파티 카드에 별점을 띄우려면 매번 세는 것보다 뷰가 낫다
drop view if exists review_stats cascade;
create view review_stats as
select
  event_id,
  count(*)::int as reviews,
  round(avg(rating)::numeric, 1) as rating
from reviews
where deleted_at is null
group by event_id;

grant select on review_stats to anon, authenticated;

-- 가입자 목록 (운영자 전용).
--
-- `auth.users` 는 앱에서 직접 못 읽는다. 프로필도 본인만 볼 수 있게
-- 막혀 있다(profiles_own). 그래서 운영 화면에 가입자가 아예 안 보였다.
--
-- **security definer 로 감싸되 함수 안에서 운영자인지 다시 확인한다.**
-- grant 만으로는 로그인한 아무나 전체 가입자와 연락처를 긁어 갈 수 있다.
--
-- 비밀번호 해시·토큰 같은 건 절대 내보내지 않는다. 화면에서 쓰는 값만.

create or replace function member_list(p_q text default null)
returns table (
  user_id      uuid,
  email        text,
  provider     text,
  is_anonymous boolean,
  joined_at    timestamptz,
  last_seen_at timestamptz,
  nickname     text,
  real_name    text,
  phone        text,
  areas        text[],
  categories   text[],
  bookings     int,
  paid         bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- **모든 컬럼에 별칭을 붙인다.** 반환 컬럼 이름(user_id, email, paid …)이
  -- 표의 컬럼 이름과 같아서, 안 붙이면 PL/pgSQL 이 어느 쪽인지 모른다고
  -- 터진다 — "column reference user_id is ambiguous".
  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'provider', '알 수 없음'),
    coalesce(u.is_anonymous, false),
    u.created_at,
    u.last_sign_in_at,
    p.nickname,
    p.real_name,
    p.phone,
    coalesce(p.areas, '{}'::text[]),
    coalesce(p.categories, '{}'::text[]),
    coalesce(b.n_bookings, 0)::int,
    coalesce(b.sum_paid, 0)::bigint
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join (
    select bk.user_id as uid,
           count(*) filter (where bk.status <> 'cancelled') as n_bookings,
           sum(bk.amount) filter (where bk.status in ('paid', 'checked_in')) as sum_paid
    from bookings bk
    where bk.user_id is not null
    group by bk.user_id
  ) b on b.uid = u.id
  where v_q is null
     or u.email ilike '%' || v_q || '%'
     or p.nickname ilike '%' || v_q || '%'
     or p.real_name ilike '%' || v_q || '%'
     or p.phone like '%' || v_q || '%'
  order by u.created_at desc
  limit 500;
end $fn$;

revoke all on function member_list from public, anon;
grant execute on function member_list to authenticated;

-- 머리에 띄울 숫자
create or replace function member_summary()
returns table (
  people    int,
  anonymous int,
  google    int,
  with_profile int,
  buyers    int
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select
    count(*) filter (where not coalesce(u.is_anonymous, false))::int,
    count(*) filter (where coalesce(u.is_anonymous, false))::int,
    count(*) filter (where u.raw_app_meta_data ->> 'provider' = 'google')::int,
    (select count(*) from profiles pr)::int,
    (select count(distinct bk.user_id) from bookings bk
     where bk.user_id is not null and bk.status <> 'cancelled')::int
  from auth.users u;
end $fn$;

revoke all on function member_summary from public, anon;
grant execute on function member_summary to authenticated;

-- 이름 + 연락처로 내 티켓 찾기.
--
-- 지금은 예매번호(PM0001)가 있어야 찾는다. 문자를 지웠거나 기기를 바꾼
-- 사람은 그 번호를 모른다 — 정작 티켓이 필요한 순간에 못 찾는다.
--
-- **연락처만으로는 안 연다.** 번호만 넣으면 남의 번호를 아는 사람이
-- 그 사람이 어느 파티에 가는지, 누구 이름으로 몇 명 예매했는지 다 본다.
-- 파티 앱에서 그건 그냥 사생활이다. 이름을 같이 받으면 예매번호를 외울
-- 필요는 없어지면서 아무나 열지는 못한다.
--
-- 이름은 띄어쓰기·대소문자를 무시하고 맞춘다. "송 우진" 이라고 적었다고
-- 못 찾으면 안 된다.

create or replace function find_bookings_by_phone(p_phone text, p_name text)
returns setof bookings
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name   text := lower(regexp_replace(coalesce(p_name, ''), '\s', '', 'g'));
begin
  if length(v_digits) < 8 then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;
  if length(v_name) < 1 then
    raise exception 'BAD_NAME' using errcode = 'P0001';
  end if;

  return query
  select bk.*
  from bookings bk
  where regexp_replace(bk.phone, '\D', '', 'g') = v_digits
    and lower(regexp_replace(bk.name, '\s', '', 'g')) = v_name
    and bk.status <> 'cancelled'
  order by bk.created_at desc;
end $fn$;

revoke all on function find_bookings_by_phone from public;
grant execute on function find_bookings_by_phone to anon, authenticated;

-- 찾은 걸 지금 세션에 전부 붙인다. 다음부터는 목록에 그냥 뜬다
create or replace function claim_bookings_by_phone(p_phone text, p_name text)
returns setof bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids uuid[];
begin
  select array_agg(bk.id) into v_ids
  from find_bookings_by_phone(p_phone, p_name) bk;

  if v_ids is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if auth.uid() is not null then
    update bookings set user_id = auth.uid()
    where id = any(v_ids) and user_id is null;
  end if;

  return query select bk.* from bookings bk
  where bk.id = any(v_ids) order by bk.created_at desc;
end $fn$;

revoke all on function claim_bookings_by_phone from public;
grant execute on function claim_bookings_by_phone to anon, authenticated;

-- 테이블 예약 (VIP · VVIP · PLUS).
--
-- 차수(ticket_tiers)와 다른 것이다. 차수는 입장권이고, 테이블은 자리를
-- 통째로 잡는 것이며 **테이블을 잡으면 입장비가 없다.** 같은 표에 섞으면
-- 정원 계산이 깨진다 — 테이블 손님은 입장권을 안 사기 때문이다.
--
-- 값은 크루가 앱에서 넣는다. 여기에 미리 적어 두지 않는다 — 파티마다
-- 다르고, 코드에 박아 두면 바꿀 때마다 배포해야 한다.

create table if not exists event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  name  text not null,               -- VIP · VVIP · PLUS
  -- 계좌이체 기준. 메뉴판이 그렇게 적혀 있다
  price int not null check (price >= 0),
  -- 카드로 결제하면 더 받는다. 비우면 안 띄운다
  card_price int check (card_price is null or card_price >= 0),
  -- 몇 명까지 앉나. 입장비가 없는 인원이 이 숫자다
  seats int not null check (seats > 0),
  note  text,                        -- 구성 (주류·안주 등)
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 테이블 전체에 공통으로 붙는 안내 (샴페인 종류·추가 가격·예약 문의 등).
-- 줄마다 반복하면 화면이 같은 말로 도배된다
alter table events add column if not exists tables_note text;

create index if not exists event_tables_event_idx
  on event_tables (event_id, sort_order);

alter table event_tables enable row level security;

-- 손님이 봐야 파는 것이다. 파티가 보이면 테이블도 보인다
drop policy if exists event_tables_read on event_tables;
create policy event_tables_read on event_tables
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status in ('open', 'closed', 'done')
        or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_tables_write on event_tables;
create policy event_tables_write on event_tables
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );

-- 파티 사진.
--
-- 커버 한 장으로는 "어떤 파티인지" 가 안 전해진다. 낮의 물, 밤의 조명,
-- DJ, 루프탑 — 다 다른 장면인데 한 장만 보고 정해야 했다.
--
-- 커버와 따로 둔다. 커버는 목록 카드에 쓰는 대표 한 장이고, 여기는
-- 상세에서만 보는 여러 장이다.

create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists event_photos_event_idx
  on event_photos (event_id, sort_order);

alter table event_photos enable row level security;

drop policy if exists event_photos_read on event_photos;
create policy event_photos_read on event_photos
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (e.status in ('open', 'closed', 'done') or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_photos_write on event_photos;
create policy event_photos_write on event_photos
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );

-- 웹 푸시 구독.
--
-- 로그인 없이 예매할 수 있는 앱이라, 푸시도 **익명 세션에 붙는다.**
-- 브라우저를 지우면 같이 날아가는데, 그건 그 브라우저가 더 이상 그
-- 사람이 아니라는 뜻이므로 맞다.
--
-- endpoint 가 사실상 키다. 같은 기기가 다시 구독하면 키가 같으므로
-- 줄이 늘지 않는다.

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id  uuid references auth.users on delete cascade,
  p256dh   text not null,
  auth     text not null,
  -- 마지막으로 보내다 실패한 시각. 죽은 구독을 지우는 근거
  failed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists push_subs_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- 본인 것만. 남의 endpoint 를 알면 그 기기로 알림을 보낼 수 있다
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 보낼 것 찾기
--
-- 크론이 30분마다 부른다. **보낼 사람만 골라 준다** — 앱이 예매를 통째로
-- 읽어 걸러 내면 그 순간 손님 명단이 서버 밖으로 나간다.
--
-- 두 가지를 본다.
--   1. 미입금이 세 시간 뒤에 풀린다  → 지금 넣으라고 알린다
--   2. 오늘 그 파티가 열린다         → 시간·장소를 알린다
--
-- 같은 걸 두 번 안 보내려고 보낸 기록을 남긴다.

create table if not exists push_log (
  booking_id uuid references bookings on delete cascade not null,
  kind text not null check (kind in ('expiring', 'today', 'paid')),
  sent_at timestamptz default now(),
  primary key (booking_id, kind)
);

create or replace function push_targets()
returns table (
  booking_id uuid,
  kind       text,
  endpoint   text,
  p256dh     text,
  auth       text,
  title      text,
  body       text,
  url        text
)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
begin
  return query
  with due as (
    select b.id as bid,
           case
             when b.status = 'pending' then 'expiring'
             else 'today'
           end as k,
           b.user_id as uid,
           b.code as code,
           e.title as ev_title,
           e.slug as ev_slug,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') as at_time,
           e.venue_name as venue
    from bookings b
    join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status <> 'cancelled'
      and (
        -- 세 시간 안에 풀린다
        (b.status = 'pending'
         and b.expires_at > now()
         and b.expires_at < now() + interval '3 hours')
        or
        -- 오늘 열린다
        (e.starts_at::date = (now() at time zone 'Asia/Seoul')::date
         and e.starts_at > now())
      )
  )
  select d.bid, d.k, s.endpoint, s.p256dh, s.auth,
    case when d.k = 'expiring' then '자리가 곧 풀려요'
         else '오늘이에요' end,
    case when d.k = 'expiring'
      then d.ev_title || ' · ' || d.code || ' 입금이 아직이에요. 세 시간 뒤 자동 취소됩니다.'
      else d.ev_title || ' · ' || d.at_time || ' ' || d.venue || ' 에서 봬요.'
    end,
    '/tickets'
  from due d
  join push_subscriptions s on s.user_id = d.uid and s.failed_at is null
  where not exists (
    select 1 from push_log l where l.booking_id = d.bid and l.kind = d.k
  );
end $fn$;

revoke all on function push_targets from public, anon, authenticated;

-- 초대 코드 = 게스트가.
--
-- **지금까지 초대 코드는 금액을 안 바꿨다.** 누가 데려왔는지 집계에만
-- 썼다. 그런데 실제로는 DJ 게스트가 30,000원, 그냥 온 사람이 49,000원
-- 이다 — 그 차이를 크루가 손으로 고쳐 왔다.
--
-- 그러면 손님은 앱에서 49,000원을 보고 예매한 뒤 "게스트인데요" 라고
-- DM 을 보내야 한다. 그걸 앱이 하게 만든다.
--
-- 비워 두면 예전과 똑같다 — 코드는 집계에만 쓰이고 금액은 안 바뀐다.
alter table events add column if not exists guest_price int
  check (guest_price is null or guest_price >= 0);

comment on column events.guest_price is
  '유효한 초대 코드를 넣었을 때의 금액. 비우면 할인 없음';

-- **옛 3인자짜리를 먼저 지운다.** 기본값이 있는 4인자와 나란히 두면
-- tier_price(t, e, 'M') 이 어느 쪽인지 모호해져서 예매가 통째로 막힌다
drop function if exists tier_price(ticket_tiers, events, text);

-- 금액 계산의 단일 진실. 초대가 있으면 게스트가가 이긴다
create or replace function tier_price(
  p_tier ticket_tiers,
  p_event events,
  p_gender text,
  p_invited boolean default false
)
returns int language sql immutable as $$
  select case
    when p_invited and p_event.guest_price is not null then p_event.guest_price
    when p_gender <> 'M' then p_tier.price
    when p_tier.male_price is not null then p_tier.male_price
    else (round(p_tier.price * p_event.male_price_multiplier / 1000.0) * 1000)::int
  end;
$$;

-- 손님이 코드를 넣는 순간 금액이 바뀌어야 한다. 그러려면 화면이 코드를
-- 물어볼 자리가 필요하다. **크루 정보는 안 준다** — 코드가 맞는지와
-- 얼마인지만 준다
create or replace function check_invite(p_event uuid, p_code text)
returns table (valid boolean, price int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_event  events;
  v_code   text := nullif(upper(trim(coalesce(p_code, ''))), '');
  v_ok     boolean := false;
begin
  select * into v_event from events where id = p_event;
  if not found then
    return query select false, null::int;
    return;
  end if;

  if v_code is not null then
    select exists (
      select 1 from crew_members m
      where m.crew_id = v_event.crew_id and m.invite_code = v_code
    ) into v_ok;
  end if;

  return query select v_ok, case when v_ok then v_event.guest_price else null end;
end $fn$;

revoke all on function check_invite from public;
grant execute on function check_invite to anon, authenticated;

-- 손님이 자기 예매를 취소한다.
--
-- 지금은 크루에게 DM 을 보내야 취소된다. 그동안 그 자리는 잠겨 있고,
-- 24시간이 지나야 자동으로 풀린다 — 마감 직전이면 그 하루가 아깝다.
--
-- **입금한 건은 손님이 못 지운다.** 환불이 얽혀 있어서 크루가 확인하고
-- 처리해야 한다. 미입금만 손님이 바로 뺀다 — 어차피 곧 자동 취소될
-- 건이고, 먼저 빼 주면 자리가 그만큼 빨리 돈다.
--
-- 입장까지 한 건은 어느 쪽도 못 지운다. 현장 기록이다.

create or replace function cancel_my_booking(p_booking uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row bookings;
begin
  select * into v_row from bookings where id = p_booking;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_row.user_id is null or v_row.user_id <> auth.uid() then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  if v_row.status = 'cancelled' then
    return v_row;
  end if;
  if v_row.status = 'checked_in' then
    raise exception 'ALREADY_IN' using errcode = 'P0001';
  end if;
  if v_row.status = 'paid' then
    raise exception 'PAID' using errcode = 'P0001';
  end if;

  update bookings set status = 'cancelled'
  where id = p_booking
  returning * into v_row;
  return v_row;
end $fn$;

revoke all on function cancel_my_booking from public;
grant execute on function cancel_my_booking to anon, authenticated;

-- 익명 계정을 진짜 계정으로 승격한다.
--
-- **이게 "구글 로그인은 됐는데 로그아웃 상태" 의 원인이다.**
--
-- 이 앱은 첫 방문에 익명 세션을 만든다(로그인 없이 예매하려고). 그
-- 상태에서 구글 로그인을 누르면 signInWithOAuth 가 아니라 linkIdentity
-- 로 간다 — 익명으로 잡아 둔 예매를 잃지 않으려고 그렇게 짰다.
--
-- 그런데 linkIdentity 는 구글 신원을 **붙이기만 하고** auth.users 의
-- is_anonymous 를 그대로 둔다. 앱은 `user && !user.is_anonymous` 로
-- 로그인 여부를 보므로, 구글 창까지 다 돌고 와도 여전히 로그아웃이다.
--
-- 그래서 콜백에서 이 함수를 부른다. **신원이 실제로 붙어 있을 때만**
-- 표시를 내린다 — 아무나 부른다고 익명이 풀리면 안 된다.

create or replace function promote_anonymous()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_id  uuid := auth.uid();
  v_has boolean;
begin
  if v_id is null then
    return false;
  end if;

  -- 익명이 아닌 신원(구글·카카오·애플·이메일)이 붙어 있는가
  select exists (
    select 1 from auth.identities i
    where i.user_id = v_id and i.provider <> 'anonymous'
  ) into v_has;

  if not v_has then
    return false;
  end if;

  update auth.users
  set is_anonymous = false, updated_at = now()
  where id = v_id and is_anonymous;

  return found;
end $fn$;

revoke all on function promote_anonymous from public, anon;
grant execute on function promote_anonymous to authenticated;

-- 요청 제한.
--
-- **제일 큰 구멍은 예매다.** 예매는 로그인 없이 받고, 신청하면 24시간
-- 자리를 잡는다. 그래서 누구든 스크립트로 80석을 통째로 잠글 수 있다.
-- 돈 한 푼 안 들이고 파티 하나를 죽이는 방법이다.
--
-- 다음은 티켓 찾기다. 예매번호가 PM0001 부터 순서라 번호를 돌려 가며
-- 전화번호를 맞춰 보면 남의 예매를 열 수 있다.
--
-- Vercel 함수는 요청마다 새로 뜨므로 메모리에 세어 봐야 소용이 없다.
-- 세는 자리는 DB 한 곳이어야 한다.

create table if not exists rate_hits (
  bucket text not null,
  window_at timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_at)
);

-- 오래된 줄은 쌓아 둘 이유가 없다
create index if not exists rate_hits_window_idx on rate_hits (window_at);

alter table rate_hits enable row level security;
-- 아무도 직접 못 읽고 못 쓴다. 아래 함수만 만진다
drop policy if exists rate_hits_none on rate_hits;
create policy rate_hits_none on rate_hits for select using (false);

/**
 * 한 번 세고, 넘었으면 false.
 *
 * 창을 고정 구간으로 자른다(초 단위 내림). 미끄러지는 창보다 거칠지만
 * 줄 하나로 끝나서 빠르고, 우리가 막으려는 건 정밀한 조절이 아니라
 * 기계로 쏟아붓는 것이다.
 */
create or replace function rate_ok(p_bucket text, p_limit int, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_win timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_seconds) * p_seconds
  );
  v_hits int;
begin
  insert into rate_hits (bucket, window_at, hits)
  values (p_bucket, v_win, 1)
  on conflict (bucket, window_at)
  do update set hits = rate_hits.hits + 1
  returning hits into v_hits;

  -- 지나간 창은 버린다. 자주 안 해도 되므로 가끔만
  if random() < 0.01 then
    delete from rate_hits where window_at < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end $fn$;

revoke all on function rate_ok from public;
grant execute on function rate_ok to anon, authenticated;

-- ─────────────────────────────────────────── 크루 온보딩
--
-- auth.users 는 앱에서 직접 못 읽는다. security definer 로 감싸되
-- **운영자만** 부를 수 있게 함수 안에서 다시 확인한다 — grant 만으로는
-- 로그인한 아무나 남의 가입 여부를 캐볼 수 있다.

create or replace function find_user_id(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select id into v_id from auth.users
  where lower(email) = lower(trim(p_email)) limit 1;
  return v_id;
end $fn$;

revoke all on function find_user_id from public, anon;
grant execute on function find_user_id to authenticated;

-- ─── 20260826000900_email_grants.sql ───────────────
-- 이메일로 권한 주기.
--
-- 구글·카카오로 로그인하면 **새 사용자가 만들어진다.** 이메일/비밀번호로
-- 만들어 둔 계정과 uuid 가 다르다. 그래서 uuid 로만 권한을 걸어 두면
-- 소셜로 처음 들어온 사람은 크루도 운영자도 아니게 된다.
--
-- 닭이 먼저냐 문제이기도 하다 — 그 사람이 한 번 로그인하기 전까지는
-- uuid 가 없어서 미리 권한을 줄 수가 없다.
--
-- 이메일을 적어 두면 그 주소로 들어온 사람이 곧바로 권한을 갖는다.
-- 크루 멤버를 미리 등록해 두는 데도 쓴다.

alter table crew_members add column if not exists email text;

create table if not exists admin_emails (
  email text primary key,
  note text,
  created_at timestamptz default now()
);

alter table admin_emails enable row level security;

-- 목록은 아무도 못 읽는다. 확인은 is_app_admin() 이 대신 한다
drop policy if exists admin_emails_none on admin_emails;
create policy admin_emails_none on admin_emails for select using (false);

-- ─────────────────────────────────────────── 판정 함수
--
-- auth.jwt() 의 email 은 제공자가 확인해 준 값이다. 사용자가 임의로
-- 못 바꾼다 — 바꾸려면 그 이메일의 소유를 다시 증명해야 한다.

create or replace function auth_email()
returns text
language sql
stable
as $fn$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$fn$;

create or replace function is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from app_admins where user_id = auth.uid())
      or exists (select 1 from admin_emails where email = auth_email());
$fn$;

create or replace function is_crew_staff(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from crews where id = p_crew_id and owner_id = auth.uid()
  ) or exists (
    select 1 from crew_members
    where crew_id = p_crew_id
      and (user_id = auth.uid() or (email is not null and lower(email) = auth_email()))
  );
$fn$;


-- ═══════════════════════════════════════════════════════════════════
--  첫 행사 데이터
-- ═══════════════════════════════════════════════════════════════════

do $init$
declare
  c_email text := (select v from _cfg where k = 'email');
  c_pw    text := (select v from _cfg where k = 'pw');
  c_bank  text := (select v from _cfg where k = 'bank');
  c_cover text := (select v from _cfg where k = 'cover');
  c_crew  text := (select v from _cfg where k = 'crew');
  c_gmail text := nullif(trim((select v from _cfg where k = 'gmail')), '');
  c_stat  text := coalesce(nullif(trim((select v from _cfg where k = 'status')), ''), 'draft');
  v_owner uuid;
  v_crew  uuid;
  v_event uuid;
begin
  select id into v_owner from auth.users
  where lower(email) = lower(trim(c_email)) limit 1;

  -- 없으면 만든다.
  --
  -- **토큰 칼럼을 빈 문자열로 채워야 한다.** null 로 두면 GoTrue 가
  -- 로그인할 때 "Database error querying schema" 로 죽는다. 한 번 당했다.
  -- email_confirmed_at 을 채우는 게 대시보드의 Auto Confirm 과 같은 뜻이다.
  if v_owner is null then
    v_owner := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current,
      email_change, phone_change, phone_change_token,
      reauthentication_token, is_sso_user, is_anonymous
    ) values (
      v_owner, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', lower(trim(c_email)),
      crypt(c_pw, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', '', '', '', '', '', false, false
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, created_at, updated_at
    ) values (
      gen_random_uuid(), v_owner, v_owner::text, 'email',
      jsonb_build_object('sub', v_owner::text, 'email', lower(trim(c_email))),
      now(), now()
    );
    raise notice '크루 계정을 만들었습니다: %', c_email;
  end if;

  -- ── 크루 ────────────────────────────────────────────────────────
  select id into v_crew from crews where slug = 'blackout';
  if v_crew is null then
    insert into crews (slug, name, bio, instagram, owner_id)
    values ('blackout', c_crew, '서울 기반 DJ 크루', 'blackout_crew', v_owner)
    returning id into v_crew;
  else
    update crews set name = c_crew, owner_id = v_owner where id = v_crew;
  end if;

  -- 멤버별 초대 코드. 크루 내부 정산 근거가 된다
  insert into crew_members (crew_id, user_id, display_name, invite_code, role) values
    (v_crew, v_owner, 'AROS', 'AROS', 'owner'),
    (v_crew, null,    'LYNN', 'LYNN', 'member'),
    (v_crew, null,    'TS',   'TS',   'member'),
    (v_crew, null,    'V',    'V',    'member')
  on conflict (crew_id, invite_code) do nothing;

  -- ── 행사 ────────────────────────────────────────────────────────
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    insert into events (
      crew_id, slug, title, subtitle, description, cover_url,
      venue_name, area, address, starts_at, ends_at, capacity,
      gender_balanced, male_price_multiplier, solo_friendly,
      genres, categories, list_price, bank_account, status
    ) values (
      v_crew,
      'after-sunset-20260829',
      'AFTER SUNSET 야외 풀파티',
      '해질녘부터 자정까지, 어나더 라운지 야외 풀장',
      E'해가 지는 시간에 시작합니다.

낮에는 물, 밤에는 조명. 같은 공간이 두 번 바뀝니다.
혼자 와도 됩니다 — 자리 잡아 드려요.',
      c_cover,
      '어나더 루프탑 라운지', '양재', '서울 서초구 양재동',
      '2026-08-29 17:00+09', '2026-08-30 00:00+09',
      80,            -- 정원
      true,          -- 성비 조절 (남녀 각 40)
      1.25,          -- 남성가 = 여성가 × 1.25
      true,          -- 1인 참여 환영
      '{"하우스","테크노"}', '{"풀파티","루프탑"}',
      59000,         -- 정가 (할인율 계산 기준)
      c_bank,
      'draft'        -- 확인 끝나면 크루 화면에서 '예매 중' 으로
    ) returning id into v_event;

    insert into ticket_tiers (event_id, name, note, price, capacity, sort_order) values
      (v_event, '1차 얼리버드', '선착순 40명', 39000, 40, 0),
      (v_event, '2차 사전예매', null,          49000, 30, 1),
      (v_event, '3차 사전예매', '마지막 차수',  59000, 10, 2);

    insert into lineups (event_id, artist_name, starts_at, sort_order) values
      (v_event, 'AROS', '17:00', 0),
      (v_event, 'LYNN', '18:30', 1),
      (v_event, 'TS',   '20:00', 2),
      (v_event, 'V',    '21:30', 3);
  else
    -- 다시 돌린 경우. 차수·라인업은 손대지 않는다 — 이미 팔렸을 수 있다
    update events
    set bank_account = c_bank, cover_url = c_cover, status = c_stat
    where id = v_event;
  end if;

  -- ── 운영자 ──────────────────────────────────────────────────────
  insert into app_admins (user_id, note) values (v_owner, '초기 운영자')
  on conflict (user_id) do nothing;

  -- ── 구글 계정 ───────────────────────────────────────────────────
  -- 구글로 로그인하면 새 사용자가 만들어져 uuid 가 다르다. 미리 uuid 를
  -- 알 수 없으니 이메일로 권한을 걸어 둔다 — 그 주소로 처음 들어오는
  -- 순간부터 크루 스태프이자 운영자가 된다
  if c_gmail is not null then
    insert into admin_emails (email, note)
    values (lower(c_gmail), '구글 로그인 운영자')
    on conflict (email) do nothing;

    insert into crew_members (crew_id, user_id, display_name, invite_code, role, email)
    values (v_crew, null, split_part(c_gmail, '@', 1), 'GOOGLE', 'owner', lower(c_gmail))
    on conflict (crew_id, invite_code) do update set email = excluded.email;

    raise notice '구글 계정 % 에 크루·운영 권한을 줬습니다', c_gmail;
  end if;
end $init$;


-- ═══════════════════════════════════════════════════════════════════
--  확인
-- ═══════════════════════════════════════════════════════════════════

select
  case
    when (select count(*) from crews) = 0
      then '★ 데이터가 안 들어갔습니다 — 위 경고를 확인하세요'
    when (select count(*) from admin_emails) = 0
      then '★ gmail 을 안 적었습니다 — 구글로 들어가도 스태프가 아닙니다'
    when (select status from events limit 1) <> 'open'
      then '작성 중입니다. 손님에게 보이려면 status 를 open 으로 바꿔 다시 돌리세요'
    else '완료 → 손님에게 보입니다'
  end as 다음할일,
  (select count(*) from crews)        as 크루,
  (select count(*) from crew_members) as 멤버,
  (select count(*) from events)       as 행사,
  (select count(*) from ticket_tiers) as 차수,
  (select count(*) from lineups)      as 라인업,
  (select count(*) from app_admins)   as 운영자,
  (select count(*) from bookings)     as 예매,
  (select status from events limit 1) as 상태,
  (select email from admin_emails limit 1) as 구글운영자;

select title, status, capacity, bank_account, left(cover_url, 40) as cover
from events;
