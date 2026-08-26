-- 광고성 푸시. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 왜 동의를 따로 받나
--
-- 정보통신망법 50조는 **광고성 정보에 사전 동의**를 요구한다. 예매 알림
-- (입금 확인·마감 임박·당일 안내)은 거래에 딸린 안내라 성격이 다르다.
-- 둘을 한 스위치에 묶으면, 예매 알림을 받으려고 켠 사람에게 광고가 가고
-- 그건 동의를 받은 게 아니다.
--
-- 그래서 스위치를 둘로 나눈다. 동의한 **시각도 남긴다** — 나중에
-- "동의한 적 없다" 는 말이 나오면 그게 유일한 근거다.
--
-- ## 기기가 아니라 사람에 붙인다
--
-- push_subscriptions 는 기기 단위다. 폰에서 광고를 끄고 노트북에서는
-- 안 껐다고 광고가 계속 오면 그건 끈 게 아니다. 동의는 profiles 에 둔다.

alter table profiles add column if not exists marketing_push boolean
  not null default false;
alter table profiles add column if not exists marketing_push_at timestamptz;

comment on column profiles.marketing_push is
  '광고성 푸시 수신 동의. 예매 알림과 별개다';
comment on column profiles.marketing_push_at is
  '동의한 시각. 동의 근거라 지우지 않는다';

-- ─────────────────────────────────────────── 보낼 대상
--
-- **동의한 사람의 살아 있는 기기만.** 예매 알림 쪽 push_targets 와 같은
-- 이유로 anon·authenticated 에서 회수한다 — 열면 손님 endpoint 가 샌다.

create or replace function marketing_targets()
returns table (
  user_id  uuid,
  endpoint text,
  p256dh   text,
  auth     text
)
language sql
security definer
set search_path = public
as $fn$
  select s.user_id, s.endpoint, s.p256dh, s.auth
  from push_subscriptions s
  join profiles p on p.user_id = s.user_id
  where p.marketing_push
    and s.failed_at is null;
$fn$;

revoke all on function marketing_targets from public, anon, authenticated;

-- ─────────────────────────────────────────── 보낸 기록
--
-- 같은 걸 두 번 보내지 않으려는 게 아니라, **언제 무엇을 누구에게
-- 보냈는지** 가 남아야 하기 때문이다. 수신거부 분쟁에서 이게 근거다.

create table if not exists marketing_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  sent_by uuid references auth.users,
  targets int not null default 0,
  sent int not null default 0,
  created_at timestamptz default now()
);

alter table marketing_log enable row level security;

-- 운영자만 본다. app_admins(uuid) 와 admin_emails(주소) 둘 다 본다 —
-- 구글로 로그인하면 새 uuid 가 생겨서 한쪽만 보면 운영자가 아니게 된다
drop policy if exists marketing_log_admin on marketing_log;
create policy marketing_log_admin on marketing_log
  for select using (
    exists (select 1 from app_admins a where a.user_id = auth.uid())
    or exists (
      select 1 from admin_emails m
      where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ─────────────────────────────────────────── 확인

select count(*) filter (where marketing_push) as 광고동의,
       count(*) as 전체프로필
from profiles;

select count(*) as 광고보낼기기 from marketing_targets();
