-- ═══════════════════════════════════════════════════════════════════
--  라인업에 얼굴을 붙인다
--
--  사진은 저장소에 있다 — public/dj/<이름>.png. 누끼에서 머리와 어깨만
--  잘라 320px 정사각, 투명 배경. 원 안에 넣으면 아래가 흘러 사라진다.
--
--  ## 왜 lineups 가 아니라 crew_members 에 다는가
--
--  크루 화면에서 파티를 고치면 lineups 행을 지우고 다시 넣는다. 거기에
--  사진 칸을 두면 크루가 시간 하나 고칠 때마다 사진이 날아간다. 사진은
--  사람 것이지 파티 것이 아니다. crew_members 에 달고 이름으로 맞춘다.
--
--  ## 왜 뷰가 필요한가
--
--  crew_members 는 스태프만 읽는다(초대 코드가 들어 있다). 손님이 보는
--  파티 페이지는 그걸 못 읽는다. 이름과 사진만 내놓는 뷰를 하나 둔다 —
--  뷰는 만든 사람 권한으로 도니 RLS 를 지나간다. 초대 코드·이메일·
--  user_id 는 안 나간다.
--
--  두 번 돌려도 안전하다. 사진 없는 사람은 그대로 첫 글자로 나온다.
-- ═══════════════════════════════════════════════════════════════════

alter table crew_members add column if not exists avatar_url text;

create or replace view crew_faces as
select crew_id, upper(display_name) as name, avatar_url
from crew_members
where avatar_url is not null;

grant select on crew_faces to anon, authenticated;

-- ─────────────────────────────────────────── BLACKOUT 셋
--
--  BHO · LII 는 누끼가 없다. 사진이 오면 같은 줄을 하나 더 넣는다.

update crew_members m
set avatar_url = v.url
from (values
  ('LYNN', '/dj/lynn.png'),
  ('AROS', '/dj/aros.png'),
  ('TS',   '/dj/ts.png')
) as v(name, url)
join crews c on c.slug = 'blackout'
where m.crew_id = c.id and upper(m.display_name) = v.name;

-- ─────────────────────────────────────────── 확인
select f.name, f.avatar_url
from crew_faces f join crews c on c.id = f.crew_id
where c.slug = 'blackout' order by f.name;
