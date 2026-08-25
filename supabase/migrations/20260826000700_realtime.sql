-- 입구에 스태프가 둘 이상 서면 서로가 처리한 걸 봐야 한다.
-- 폴링을 돌리면 행사장 와이파이에서 배터리와 대역폭을 먹는다.
--
-- **RLS 는 그대로 적용된다.** 크루 스태프만 그 행사의 bookings 를 읽을 수
-- 있으므로 손님 예매가 남에게 흘러가지 않는다.

alter publication supabase_realtime add table bookings;
