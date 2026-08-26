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
