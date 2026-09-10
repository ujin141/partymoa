-- 알림 두 가지를 더한다. Supabase SQL 편집기에 붙여 넣고 실행.
--
--   host      호스트에게 — 예매가 들어오면 바로 (앱이 직접 보낸다)
--   tomorrow  손님에게  — 파티 전날 저녁, 시간·장소·입금계좌
--
-- **두 번 돌려도 안전하다.**
--
-- ## 시간대 버그가 되살아나 있다
--
-- PUSH_FIX.sql 이 고친 걸 PUSH_APNS.sql 이 도로 가져왔다. platform 칸을
-- 붙이면서 그 전 본문을 복사한 탓이다.
--
--   (e.starts_at::date = (now() at time zone 'Asia/Seoul')::date)
--    ^^^^^^^^^^^^^^^^^ 이쪽만 UTC 다
--
-- starts_at::date 는 서버 시간대(UTC)로 떨어진다.
--
--   9/27 00:30 KST = 9/26 15:30 UTC  →  UTC 로는 9/26
--
-- 자정을 넘겨 시작하는 파티에서 당일 알림이 **하루 일찍** 나간다.
-- AFTER MOON 은 22:00 시작이라 지금은 안 걸리지만, 새벽에 시작하는
-- 파티를 하나라도 열면 바로 터진다. 양쪽 다 서울 시각으로 맞춘다.
--
-- ## 전날 알림을 저녁에만 보내는 이유
--
-- 크론이 30분마다 돈다. 조건만 "내일 열린다" 로 두면 **자정 직후에
-- 울린다.** 새벽 두 시에 폰이 울리면 그 사람은 알림을 꺼 버린다.
-- 그래서 서울 시각 19~22시 사이에만 보낸다. 그 사이 첫 크론이 보내고,
-- push_log 가 나머지를 막는다.

-- ─────────────────────────────────────────── 1. 로그가 새 종류를 받게
--
-- kind 에 체크 제약이 걸려 있다. 안 풀면 새 알림을 보내고 나서
-- 기록하는 자리에서 죽고, 다음 크론이 같은 걸 또 보낸다.
alter table push_log drop constraint if exists push_log_kind_check;
alter table push_log add constraint push_log_kind_check
  check (kind in ('expiring', 'today', 'paid', 'tomorrow', 'host'));


-- ─────────────────────────────────────────── 2. 보낼 것 찾기
--
-- PUSH_APNS.sql 의 platform 칸을 그대로 두고, PUSH_FIX.sql 의 시간대
-- 수정을 되살리고, tomorrow 를 더했다.
--
-- **세 갈래를 union 으로 나눈다.** 예전에는 case 하나로 갈랐는데,
-- 종류가 늘면 어느 갈래가 어떤 이름을 받는지 읽어서 알기 어렵다.

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
declare
  -- 지금 서울 몇 시인가. 전날 알림을 저녁에만 보내려고 본다
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'));
begin
  return query
  with due as (
    -- 세 시간 안에 자리가 풀린다
    select b.id as bid, 'expiring'::text as k, b.user_id as uid,
           b.code, e.title as ev_title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') as at_time,
           e.venue_name as venue, e.bank_account as bank, b.amount as amount
    from bookings b
    join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status = 'pending'
      and b.expires_at > now()
      and b.expires_at < now() + interval '3 hours'

    union all

    -- 오늘 열린다. **양쪽 다 서울 시각으로 본다**
    select b.id, 'today', b.user_id,
           b.code, e.title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI'),
           e.venue_name, e.bank_account, b.amount
    from bookings b
    join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status <> 'cancelled'
      and (e.starts_at at time zone 'Asia/Seoul')::date
          = (now() at time zone 'Asia/Seoul')::date
      and e.starts_at > now()

    union all

    -- 내일 열린다. **입금이 끝난 사람에게만.**
    -- 아직 미입금인 사람에게는 expiring 이 따로 간다. 둘 다 보내면
    -- 같은 밤에 두 번 울린다
    select b.id, 'tomorrow', b.user_id,
           b.code, e.title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI'),
           e.venue_name, e.bank_account, b.amount
    from bookings b
    join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status = 'paid'
      and v_hour between 19 and 21
      and (e.starts_at at time zone 'Asia/Seoul')::date
          = ((now() at time zone 'Asia/Seoul') + interval '1 day')::date
  )
  select d.bid, d.k, s.endpoint, s.p256dh, s.auth, s.platform,
    case d.k
      when 'expiring' then '자리가 곧 풀려요'
      when 'today'    then '오늘이에요'
      else '내일 봬요'
    end,
    case d.k
      when 'expiring' then
        d.ev_title || ' · ' || d.code || ' 입금이 아직이에요. 세 시간 뒤 자동 취소됩니다.'
      when 'today' then
        d.ev_title || ' · ' || d.at_time || ' ' || d.venue || ' 에서 봬요.'
      else
        -- 전날 알림은 **현장에서 필요한 것만** 적는다. 시간·장소·예매번호.
        -- 여기서 다 보이면 입구에서 앱을 안 열어도 된다
        d.ev_title || ' · 내일 ' || d.at_time || ' ' || d.venue ||
        chr(10) || '예매번호 ' || d.code || ' · 입구에서 보여 주세요'
    end,
    '/tickets'
  from due d
  join push_subscriptions s on s.user_id = d.uid and s.failed_at is null
  where not exists (
    select 1 from push_log l where l.booking_id = d.bid and l.kind = d.k
  );
end $fn$;

revoke all on function push_targets from public, anon, authenticated;


-- ─────────────────────────────────────────── 3. 확인
--
-- 지금 보낼 게 있는지 본다. 없으면 0줄이 정상이다.
select kind, count(*) as 건수 from push_targets() group by kind order by kind;

-- 제약이 새 종류를 받는지
select pg_get_constraintdef(oid) as push_log_kind
from pg_constraint where conname = 'push_log_kind_check';
