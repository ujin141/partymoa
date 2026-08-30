-- 끝난 파티의 기록. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 무엇을 공개하나
--
-- **집계만 공개한다.** 이름·연락처·예매번호는 한 줄도 안 나간다.
-- 손님은 파티에 온 것이지 웹에 이름을 올리려고 온 게 아니다.
--
-- 성비도 넣는다. 캡션에는 안 쓰기로 했는데 그건 **팔기 전** 이야기였다 —
-- 미리 말하면 당일 보장이 되지만, 끝난 뒤에 적는 건 그날 실제로 그랬다는
-- 기록이다.
--
-- ## 왜 뷰인가
--
-- 파생값을 저장하지 않는다는 규칙 그대로다. 나중에 한 건이 취소되거나
-- 고쳐지면 기록도 같이 맞아야 한다.

create or replace view event_recap as
select
  e.id as event_id,
  e.slug,
  e.capacity,
  coalesce(sum(b.quantity) filter (where b.status = 'checked_in'), 0)::int
    as came,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'), 0)::int
    as booked,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'
                                     and b.gender = 'F'), 0)::int as booked_f,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'
                                     and b.gender = 'M'), 0)::int as booked_m,
  -- 혼자 온 사람. 이 서비스가 파는 게 그거라 숫자로 남긴다
  count(*) filter (where b.status <> 'cancelled' and b.quantity = 1)::int
    as solo,
  count(distinct b.table_id) filter (where b.table_id is not null)::int
    as tables,
  count(distinct b.invite_code) filter (where b.invite_code is not null)::int
    as inviters
from events e
left join bookings b on b.event_id = e.id
where e.status = 'done'
group by e.id;

-- **금액은 한 줄도 안 넣었다.** 매출은 크루와 우리 사이의 숫자다.
grant select on event_recap to anon, authenticated;
