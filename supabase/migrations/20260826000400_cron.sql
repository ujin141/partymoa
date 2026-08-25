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
