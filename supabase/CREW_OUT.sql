-- 크루를 나간 사람을 명단에서 뺀다.
--
-- CHIPS(cheeps) · HEIDY · DEMIC · V — 넷 다 사이트에서는 이미 지웠고
-- 여기는 파티모아 쪽 크루원(추천인 코드) 명단이다.
--
-- ## 지우기 전에 센다
--
-- 추천인 코드는 예매에 글자로 남는다. **이미 그 코드로 들어온 손님이
-- 있으면 지우면 안 된다** — 크루 화면에서 그 예매가 '멤버에 없는 코드'
-- 로 떨어져 나가고, 누가 데려왔는지가 흐려진다.
--
-- 아래가 0 이 아니면 그 사람은 두고 나머지만 지울 것.

select m.display_name, m.invite_code,
       (select coalesce(sum(b.quantity), 0) from bookings b
        where b.invite_code = m.invite_code and b.status <> 'cancelled') as 데려온인원
from crew_members m
where m.invite_code in ('CHEEPS', 'CHIPS', 'HEIDY', 'DEMIC', 'V')
order by m.invite_code;

-- ─────────────────────────────────────────── 지우기
--
-- 위 결과가 전부 0 인 것을 확인한 뒤에 실행한다.
-- **데려온 인원이 있는 코드는 여기서 빼고 돌릴 것.**

delete from crew_members
where invite_code in ('CHEEPS', 'CHIPS', 'HEIDY', 'DEMIC', 'V')
  and not exists (
    select 1 from bookings b
    where b.invite_code = crew_members.invite_code
      and b.status <> 'cancelled'
  );

-- ─────────────────────────────────────────── 확인
select display_name, invite_code from crew_members order by display_name;
