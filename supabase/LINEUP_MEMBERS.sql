-- 멤버(초대 코드)를 AFTER MOON 라인업에 맞춘다.
--
--   라인업   BHO · LYNN · LII · AROS · TS
--
-- 없는 사람은 넣고, 라인업에 없는 사람은 뺀다.
-- **두 번 돌려도 안전하다.**
--
-- ## 안 지우는 것 네 가지
--
-- `bookings.invite_code` 는 텍스트라 외래키가 없다. 그래서 멤버를 지워도
-- 예매는 안 지워지지만, **명단에서 추천인 이름이 빈칸이 된다.** 게스트가를
-- 왜 줬는지 근거도 같이 사라진다. 정산 때 이걸 다시 맞추는 건 사람 일이다.
--
--   1. 대표(role = 'owner')          — 지우면 자기 크루에서 밀려난다
--   2. REVIEW                        — 앱 심사용. 지우면 심사가 또 막힌다
--   3. XANTHIC · WOOJIN              — 라인업에 없지만 남기기로 한 사람
--   4. 코드가 예매에 한 번이라도 쓰인 멤버
--
-- 4번에 걸려 안 지워진 사람은 맨 아래 확인 질의에 남는다. 그건 눈으로
-- 보고 판단한다 — 정산이 끝난 뒤에 지우면 된다.

-- ─────────────────────────────────────────── 1. 지금 누가 있나
--
-- 먼저 이것만 돌려서 본다. 예상과 다르면 아래를 돌리지 말 것.
select
  m.display_name as 이름,
  m.invite_code  as 코드,
  m.role         as 역할,
  (m.user_id is not null) as 로그인연결,
  (select count(*) from bookings b
     where upper(b.invite_code) = m.invite_code) as 예매수,
  (m.invite_code in ('BHO','LYNN','LII','AROS','TS')) as 라인업
from crew_members m
join crews c on c.id = m.crew_id
where c.slug = 'blackout'
order by 라인업 desc, 예매수 desc, m.display_name;


-- ─────────────────────────────────────────── 2. 라인업 넣기
--
-- 이미 있으면 이름만 맞춘다. user_id 는 안 건드린다 —
-- 로그인 붙여 둔 사람이 끊기면 안 된다.
insert into crew_members (crew_id, display_name, invite_code, role)
select c.id, v.name, v.code, 'member'
from crews c,
     (values ('BHO','BHO'), ('LYNN','LYNN'), ('LII','LII'),
             ('AROS','AROS'), ('TS','TS')) as v(name, code)
where c.slug = 'blackout'
on conflict (crew_id, invite_code)
  do update set display_name = excluded.display_name;


-- ─────────────────────────────────────────── 3. 라인업에 없는 사람 빼기
--
-- 위 네 가지에 걸리는 사람은 남는다.
delete from crew_members m
using crews c
where c.id = m.crew_id
  and c.slug = 'blackout'
  and m.invite_code not in ('BHO','LYNN','LII','AROS','TS')
  and m.role <> 'owner'
  and m.invite_code not in ('REVIEW', 'XANTHIC', 'WOOJIN')
  and not exists (
    select 1 from bookings b
    where upper(b.invite_code) = m.invite_code
  );


-- ─────────────────────────────────────────── 4. 확인
--
-- 라인업 다섯 명 + 남은 사람. 남은 사람은 왜 남았는지가 같이 나온다.
select
  m.display_name as 이름,
  m.invite_code  as 코드,
  case
    when m.invite_code in ('BHO','LYNN','LII','AROS','TS') then '라인업'
    when m.role = 'owner'         then '남김 — 대표'
    when m.invite_code = 'REVIEW'  then '남김 — 앱 심사용'
    when m.invite_code in ('XANTHIC','WOOJIN') then '남김 — 지정'
    else '남김 — 예매에 쓰인 코드'
  end as 상태,
  (select count(*) from bookings b
     where upper(b.invite_code) = m.invite_code) as 예매수
from crew_members m
join crews c on c.id = m.crew_id
where c.slug = 'blackout'
order by 상태, m.display_name;
