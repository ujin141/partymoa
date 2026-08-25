-- ═══════════════════════════════════════════════════════════
-- 파티모아 전체 스키마 — 한 번에 돌리는 판
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 마이그레이션 8개를 순서대로 이어 붙인 것이다. 순서가 중요하다 —
-- RLS 가 앞 파일의 테이블을 참조한다.
-- ═══════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────
-- 20260826000100_init.sql
-- ───────────────────────────────────────────────────────────
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
  owner_id uuid references auth.users not null,
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

  -- 금액도 서버가 정한다. 클라이언트가 보낸 금액은 쓰지 않는다
  v_price := round(
    case when p_gender = 'M'
      then v_tier.price * v_event.male_price_multiplier
      else v_tier.price::numeric
    end / 1000.0
  )::int * 1000;
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


-- ───────────────────────────────────────────────────────────
-- 20260826000200_rls.sql
-- ───────────────────────────────────────────────────────────
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

create policy crews_read on crews
  for select using (true);

create policy crews_insert on crews
  for insert with check (owner_id = auth.uid());

create policy crews_write on crews
  for update using (owner_id = auth.uid());

create policy crews_delete on crews
  for delete using (owner_id = auth.uid());

-- 멤버 목록은 공개하지 않는다. 초대 코드가 정산 근거라 노출되면 곤란하다
create policy crew_members_read on crew_members
  for select using (is_crew_staff(crew_id));

create policy crew_members_write on crew_members
  for all using (
    exists (select 1 from crews where id = crew_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from crews where id = crew_id and owner_id = auth.uid())
  );

-- ─────────────────────────────────────────── 파티

create policy events_read_open on events
  for select using (status = 'open' or is_crew_staff(crew_id));

create policy events_write on events
  for all using (is_crew_staff(crew_id)) with check (is_crew_staff(crew_id));

create policy tiers_read on ticket_tiers
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status = 'open' or is_crew_staff(e.crew_id))
    )
  );

create policy tiers_write on ticket_tiers
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

create policy lineups_read on lineups
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status = 'open' or is_crew_staff(e.crew_id))
    )
  );

create policy lineups_write on lineups
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─────────────────────────────────────────── 예매
--
-- insert 정책이 **없다.** 일부러 그렇다. create_booking(security definer)
-- 만이 행을 만든다.

create policy bookings_read_own on bookings
  for select using (
    (user_id is not null and user_id = auth.uid()) or is_event_staff(event_id)
  );

create policy bookings_update_staff on bookings
  for update using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─────────────────────────────────────────── 찜 · 팔로우

create policy favorites_own on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

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


-- ───────────────────────────────────────────────────────────
-- 20260826000300_expenses.sql
-- ───────────────────────────────────────────────────────────
-- 정산 지출. 사양서 6절의 "대관료 (크루 입력)" 이 들어갈 자리가
-- 5절 스키마에 없었다. 행 단위로 두면 대관료·홍보비 말고 다른 항목이
-- 생겨도 스키마를 안 고친다.

create table event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  label text not null,
  amount int not null check (amount >= 0),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index event_expenses_event_idx on event_expenses (event_id, sort_order);

alter table event_expenses enable row level security;

create policy expenses_staff on event_expenses
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));


-- ───────────────────────────────────────────────────────────
-- 20260826000400_cron.sql
-- ───────────────────────────────────────────────────────────
-- 미입금 자동 취소. 사양서 3-3.
--
-- Edge Function 을 쓰지 않고 pg_cron 안에서 끝낸다. 취소는 DB 안의
-- update 한 줄이고, 정원 반환은 뷰가 알아서 한다 — 네트워크를 한 번
-- 나갔다 오는 구조를 만들면 실패 지점만 늘어난다.

create extension if not exists pg_cron;

select cron.schedule(
  'expire-unpaid-bookings',
  '*/10 * * * *',                       -- 10분마다. 24시간 마감에 충분하다
  $cron$ select public.expire_unpaid_bookings(); $cron$
);


-- ───────────────────────────────────────────────────────────
-- 20260826000500_find_booking.sql
-- ───────────────────────────────────────────────────────────
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


-- ───────────────────────────────────────────────────────────
-- 20260826000600_community.sql
-- ───────────────────────────────────────────────────────────
-- 커뮤니티 자유 게시판.
--
-- 글쓰기는 RPC 로만 들어온다. insert 정책을 열면 닉네임·본문 길이 검사와
-- 도배 방지를 우회하는 길이 생긴다 — 예매와 같은 원칙이다.
--
-- user_id 가 null 일 수 있다. 익명 로그인을 안 켠 프로젝트에서도 글은
-- 써지게 하되, 그런 글은 본인이 지울 수 없다(누가 본인인지 알 수 없으므로).

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  nickname text not null,
  body text not null,
  event_id uuid references events on delete set null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index posts_live_idx on posts (created_at desc) where deleted_at is null;
create index posts_user_idx on posts (user_id, created_at desc);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users,
  nickname text not null,
  body text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index post_comments_post_idx on post_comments (post_id, created_at);

-- 목록에서 댓글 수를 세려고 매번 조인하지 않는다
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

create policy posts_read on posts
  for select using (deleted_at is null);

create policy posts_own_write on posts
  for update using (user_id is not null and user_id = auth.uid())
  with check (user_id is not null and user_id = auth.uid());

create policy comments_read on post_comments
  for select using (deleted_at is null);

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


-- ───────────────────────────────────────────────────────────
-- 20260826000700_realtime.sql
-- ───────────────────────────────────────────────────────────
-- 입구에 스태프가 둘 이상 서면 서로가 처리한 걸 봐야 한다.
-- 폴링을 돌리면 행사장 와이파이에서 배터리와 대역폭을 먹는다.
--
-- **RLS 는 그대로 적용된다.** 크루 스태프만 그 행사의 bookings 를 읽을 수
-- 있으므로 손님 예매가 남에게 흘러가지 않는다.

alter publication supabase_realtime add table bookings;


-- ───────────────────────────────────────────────────────────
-- 20260826000800_admin.sql
-- ───────────────────────────────────────────────────────────
-- 플랫폼 운영자.
--
-- 크루 스태프(is_crew_staff)와 다른 층이다. 크루는 자기 행사만 보고,
-- 운영자는 전부 본다 — 수수료 집계와 크루 온보딩이 운영자 일이다.
--
-- 역할을 auth 메타데이터에 넣지 않고 테이블로 둔다. 메타데이터는 클라이언트
-- 토큰에 실려 나가고, 실수로 수정 가능한 자리에 권한을 두면 안 된다.

create table app_admins (
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
create policy admins_self on app_admins
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────── 운영자 읽기 권한
--
-- 기존 정책을 고치지 않고 정책을 더한다. 여러 정책은 OR 로 묶이므로
-- 크루 정책은 그대로 두고 운영자 통로만 하나 더 낸다.

create policy events_admin_read on events for select using (is_app_admin());
create policy bookings_admin_read on bookings for select using (is_app_admin());
create policy tiers_admin_read on ticket_tiers for select using (is_app_admin());
create policy crew_members_admin_read on crew_members
  for select using (is_app_admin());
create policy expenses_admin_read on event_expenses
  for select using (is_app_admin());
create policy posts_admin_all on posts
  for all using (is_app_admin()) with check (is_app_admin());
create policy comments_admin_all on post_comments
  for all using (is_app_admin()) with check (is_app_admin());
create policy crews_admin_write on crews
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
    coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0) * 0.07
  )::bigint as fee
from events e
join crews c on c.id = e.crew_id
left join bookings b on b.event_id = e.id
group by e.id, c.name;

revoke all on platform_stats from anon;
grant select on platform_stats to authenticated;

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

