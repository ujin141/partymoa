-- ═══════════════════════════════════════════════════════════════════
--  APPLY.sql — 아직 안 돌린 것 전부. **한 번만 붙여 넣으면 됩니다.**
--
--  들어 있는 것
--   0. **예매 금액 계산 고침 (급함)** — 화면은 69,000, 저장은 74,000
--      으로 갈리고 있습니다. 내 티켓에 다른 값이 뜨는 게 이것입니다
--   1. 크루 신청 표 (crew_applications) + 권한
--   2. 프로필 (profiles)
--   3. 후기 (reviews) + 자격 판정 can_review()
--   4. 수수료 10% — platform_stats 뷰
--
--  두 번 돌려도 안전합니다. 이미 있으면 건너뜁니다.
--
--  ⚠ 수수료는 지난 행사까지 같이 10% 로 다시 계산됩니다. 파생값을
--    저장하지 않고 매번 집계하는 구조라 그렇습니다. 정산이 끝난 행사가
--    있으면 돌리기 전에 그 금액을 적어 두세요.
--
--  연락처·게스트 정리는 GUEST_INFO.sql, 운영자 잠금은 LOCK_ADMIN.sql
--  로 따로 있습니다.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────── 0. 예매 금액 계산 (급함)
--
--  **화면과 서버가 다른 값을 쓰고 있다.**
--  차수별 남성가(male_price)를 넣을 때 앱과 tier_price() 는 고쳤는데,
--  실제로 금액을 정하는 create_booking() 은 옛 계산을 그대로 들고 있다.
--  그래서 3차 남성이 화면에서 69,000 을 보고 누르면 74,000 으로 저장된다.
--  내 티켓에 다른 값이 뜨는 게 이것이다.
--
--  차수별 남성가 컬럼과 tier_price() 도 여기서 같이 보장한다 —
--  EVENT_UPDATE.sql 을 안 돌렸어도 이 파일 하나로 맞는다.

alter table ticket_tiers add column if not exists male_price int;
do $$ begin
  alter table ticket_tiers add constraint ticket_tiers_male_price_check
    check (male_price is null or male_price >= 0);
exception when duplicate_object then null;
end $$;

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

-- ───────────────────────────────────────── 1. 크루 신청

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

-- ───────────────────────────────────────── 2. 프로필 · 3. 후기

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

-- ───────────────────────────────────────── 4. 수수료 10%

-- 플랫폼 수수료 10% 로.
--
-- 앱의 lib/rules.ts 는 코드로 배포되지만, platform_stats 뷰는 DB 안에
-- 숫자를 따로 들고 있다. 운영 화면이 그 뷰에서 읽으므로 여기까지 고쳐야
-- 청구한 값과 우리가 보는 값이 같아진다.
--
-- 이미 지난 행사의 수수료도 같이 10% 로 다시 계산된다. 파생값을 저장하지
-- 않고 매번 집계하는 구조라 그렇다 — 정산이 끝난 행사가 있으면 이 파일을
-- 돌리기 전에 그 금액을 따로 적어 두세요.

create or replace view platform_stats
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

-- ───────────────────────────────────────── 우리 크루

-- 공식 인스타그램. 파티 상세의 '주최' 옆에 링크로 붙고,
-- 운영 화면 크루 목록에서도 바로 열린다
update crews set instagram = 'blackoutcrew_official' where slug = 'blackout';

-- AFTER SUNSET 커버. 릴스 원본(P1023231)에서 풀장 장면을 한 프레임 뽑아
-- 5:3 으로 자르고 색을 올렸다. 원본이 로그에 가까워 평평해서, 그대로
-- 쓰면 카드가 뿌옇게 보인다. 파일은 우리 서버에 있다
update events set cover_url = '/covers/after-sunset.jpg'
where slug = 'after-sunset-20260829';

-- ───────────────────────────────────────── 확인

-- **금액이 어긋난 예매.** 앞으로 들어올 예매는 위에서 고쳤지만, 이미
-- 저장된 건은 그대로다. 자동으로 안 고친다 — GUEST_INFO.sql 로 실제
-- 입금액을 넣어 둔 건들이 차수 가격으로 되돌아가면 매출이 다시 틀어진다.
-- 여기 뜨는 건만 보고 정하세요.
select '금액이 어긋난 예매' as 구분,
       b.code as 예매번호, b.name as 이름, b.gender as 성별,
       t.name as 차수, b.amount as 저장된금액,
       tier_price(t, e, b.gender) * b.quantity as 계산된금액,
       b.created_at as 신청
from bookings b
join ticket_tiers t on t.id = b.tier_id
join events e on e.id = b.event_id
where b.status <> 'cancelled'
  and b.amount <> tier_price(t, e, b.gender) * b.quantity
order by b.created_at desc;



select '표가 생겼나' as 구분,
  to_regclass('public.crew_applications') is not null as 크루신청,
  to_regclass('public.profiles') is not null as 프로필,
  to_regclass('public.reviews') is not null as 후기;

select '수수료' as 구분, title as 파티, revenue_paid as 확정매출, fee as 수수료
from platform_stats order by starts_at desc;
