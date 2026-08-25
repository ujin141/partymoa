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
