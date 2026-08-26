-- ═══════════════════════════════════════════════════════════════════
--  앱 추천 코드 BHO
--
--  DJ 개인 코드가 아니라 **크루 전체가 쓰는 코드**입니다. 인스타
--  스토리, 오픈챗, 지인 소개처럼 "누가 데려왔는지" 를 사람 단위로
--  나눌 수 없는 자리에 이걸 씁니다.
--
--  코드가 붙는 순간 게스트 가격이 적용됩니다(events.guest_price).
--  그 값을 안 채워 두면 코드는 집계에만 쓰이고 금액은 안 바뀝니다.
--
--  ⚠ 이 파일 대신 앱에서 해도 됩니다 — 크루 현황 → 멤버별 초대 →
--    "+ 초대 코드 추가" 에 이름과 코드를 넣으면 같은 결과입니다.
-- ═══════════════════════════════════════════════════════════════════

insert into crew_members (crew_id, user_id, display_name, invite_code, role)
select c.id, null, '앱 추천', 'BHO', 'member'
from crews c
where c.name = 'BLACKOUT'
on conflict do nothing;

-- 넣은 걸 눈으로 본다
select m.display_name as 이름,
       m.invite_code  as 코드,
       m.role         as 역할
from crew_members m
join crews c on c.id = m.crew_id
where c.name = 'BLACKOUT'
order by m.role desc, m.display_name;
