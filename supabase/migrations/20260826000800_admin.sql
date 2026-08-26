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
