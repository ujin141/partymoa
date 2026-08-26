-- ═══════════════════════════════════════════════════════════════════
--  APPLY.sql — 아직 안 돌린 것 전부. **한 번만 붙여 넣으면 됩니다.**
--
--  들어 있는 것
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

-- ───────────────────────────────────────── 확인

select '표가 생겼나' as 구분,
  to_regclass('public.crew_applications') is not null as 크루신청,
  to_regclass('public.profiles') is not null as 프로필,
  to_regclass('public.reviews') is not null as 후기;

select '수수료' as 구분, title as 파티, revenue_paid as 확정매출, fee as 수수료
from platform_stats order by starts_at desc;
