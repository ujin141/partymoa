-- 푸시가 실제로 가게. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 시간대
--
-- "오늘 열리는 파티" 를 `e.starts_at::date` 로 봤다. starts_at 은
-- timestamptz 라 이 캐스팅은 **서버 시간대(UTC)** 로 떨어진다.
--
--   8/29 17:00 KST = 8/29 08:00 UTC  →  UTC 로도 8/29. 맞는다
--   8/30 00:00 KST = 8/29 15:00 UTC  →  UTC 로는 8/29. **하루 어긋난다**
--
-- 자정을 넘겨 시작하는 파티에서 당일 알림이 전날 나간다. 양쪽 다
-- 서울 시각으로 맞춘다.
--
-- ## 로그 테이블
--
-- push_log 에 RLS 가 안 걸려 있었다. 정책 없이 켠다 — 서비스 롤만
-- 지나가면 되고, 손님이나 크루가 볼 이유가 없는 표다.

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
        -- 오늘 열린다. **양쪽 다 서울 시각으로 본다**
        ((e.starts_at at time zone 'Asia/Seoul')::date
           = (now() at time zone 'Asia/Seoul')::date
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

-- **anon·authenticated 는 계속 막는다.** 열면 손님 endpoint 가 새고,
-- 그 endpoint 를 아는 사람은 그 기기로 알림을 보낼 수 있다.
-- 크론은 서비스 롤로 부른다.
revoke all on function push_targets from public, anon, authenticated;

-- 정책 없이 RLS 만 켠다 → 서비스 롤 말고는 아무도 못 본다
alter table push_log enable row level security;

-- ─────────────────────────────────────────── 확인

-- 지금 보낼 게 있는지. 0 이어도 정상이다 — 조건에 걸리는 예매가 없을 뿐
select count(*) as 보낼건수 from push_targets();

-- 구독한 기기 수
select count(*) as 구독기기, count(*) filter (where failed_at is null) as 살아있음
from push_subscriptions;
