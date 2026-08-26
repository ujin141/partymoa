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

select title as 파티, revenue_paid as 확정매출, fee as 수수료
from platform_stats order by starts_at desc;
