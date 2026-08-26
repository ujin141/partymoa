-- 아이폰 앱 푸시(APNs). Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 왜 표를 따로 안 만드나
--
-- 같은 사람의 같은 알림이다. 표를 나누면 "누구에게 보낼지" 를 고르는
-- push_targets 를 두 벌 쓰게 되고, 죽은 구독 정리도 두 벌이 된다.
-- 기기 종류만 한 칸 늘린다.
--
-- ## 웹푸시와 뭐가 다른가
--
--   웹    endpoint = 브라우저가 준 주소, p256dh · auth = 암호화 키
--   iOS   endpoint = APNs 디바이스 토큰, 키는 없다
--
-- 그래서 p256dh · auth 의 not null 을 푼다. iOS 행에는 넣을 값이 없다.
-- endpoint 가 계속 기본키다 — 디바이스 토큰도 기기마다 하나다.
--
-- ## 두 번 실행해도 안전하다

-- ─────────────────────────────────────────── 기기 종류

alter table push_subscriptions add column if not exists platform text
  not null default 'web';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'push_subscriptions_platform_check'
  ) then
    alter table push_subscriptions add constraint push_subscriptions_platform_check
      check (platform in ('web', 'ios'));
  end if;
end $$;

alter table push_subscriptions alter column p256dh drop not null;
alter table push_subscriptions alter column auth   drop not null;

comment on column push_subscriptions.platform is
  'web = 브라우저 구독, ios = APNs 디바이스 토큰. ios 는 p256dh · auth 가 비어 있다';

-- ─────────────────────────────────────────── 보낼 것 찾기
--
-- 반환 칸이 늘어나므로 create or replace 로는 안 바뀐다. 지우고 다시 만든다.
-- 내용은 그대로고 platform 한 칸만 붙었다.

drop function if exists push_targets();

create function push_targets()
returns table (
  booking_id uuid,
  kind       text,
  endpoint   text,
  p256dh     text,
  auth       text,
  platform   text,
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
  select d.bid, d.k, s.endpoint, s.p256dh, s.auth, s.platform,
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

-- ─────────────────────────────────────────── 광고 쪽도 같이
--
-- PUSH_ADS.sql 을 먼저 돌렸으면 이것도 바꿔야 한다. 안 돌렸으면
-- 아래 블록은 조용히 넘어간다.

do $$
begin
  if to_regprocedure('public.marketing_targets()') is not null then
    drop function marketing_targets();

    execute $fn$
      create function marketing_targets()
      returns table (
        user_id  uuid,
        endpoint text,
        p256dh   text,
        auth     text,
        platform text
      )
      language sql
      security definer
      set search_path = public
      as $body$
        select s.user_id, s.endpoint, s.p256dh, s.auth, s.platform
        from push_subscriptions s
        join profiles p on p.user_id = s.user_id
        where p.marketing_push
          and s.failed_at is null;
      $body$;
    $fn$;

    revoke all on function marketing_targets from public, anon, authenticated;
  end if;
end $$;

-- ─────────────────────────────────────────── 확인

select platform, count(*) as 기기수
from push_subscriptions
group by platform;
