-- ═══════════════════════════════════════════════════════════════════
--  운영자 한 명 더 — 전부 열어 준다
--
--  이 주소에 세 가지를 다 붙입니다.
--    1. 운영 화면 (/admin) — 전 크루의 명단·매출을 본다
--    2. 크루 화면 (/crew)  — BLACKOUT 의 예매·입장·정산
--    3. 손님 화면          — 원래 누구나 쓴다
--
--  **권한이 두 갈래인 이유가 있습니다.** 구글 로그인은 이메일로 붙고,
--  RLS 는 uuid 로 봅니다. 그래서 이메일과 uuid 를 둘 다 채웁니다.
--  아직 한 번도 로그인한 적이 없으면 uuid 가 없으므로, **그 사람이
--  구글로 한 번 로그인한 뒤에 이 파일을 한 번 더 돌리세요.**
--  두 번 돌려도 안전합니다.
--
--  두 번째로 돌릴 때 뭐가 채워졌는지는 맨 아래 표에서 확인합니다.
-- ═══════════════════════════════════════════════════════════════════

create temp table if not exists _new (email text primary key, note text);
truncate _new;
insert into _new (email, note) values
  ('dlqudgh36444@gmail.com', '운영자');

-- ─────────────────────────────────────────── 1. 운영 화면

insert into admin_emails (email, note)
select lower(email), note from _new
on conflict (email) do nothing;

-- 이미 로그인한 적이 있으면 uuid 권한까지 붙인다
insert into app_admins (user_id, note)
select u.id, n.note
from auth.users u
join _new n on lower(u.email) = lower(n.email)
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────── 2. 크루 화면
--
--  크루 스태프는 crew_members 한 줄로 정해집니다. 이메일만 적어 두면
--  화면에는 크루가 뜨지만 RLS 가 막습니다 — uuid 도 채워야 명단이
--  실제로 열립니다.
--
--  초대 코드는 비울 수 없는 칸이라 하나 넣습니다. 손님에게 나눠 줄
--  코드가 아니라 자리 채우기입니다. 쓸 일이 있으면 앱에서 이름과
--  코드를 바꾸면 됩니다.

insert into crew_members (crew_id, user_id, display_name, invite_code, email, role)
select c.id,
       (select u.id from auth.users u
        where lower(u.email) = 'dlqudgh36444@gmail.com'),
       '운영',
       'STAFF2',
       'dlqudgh36444@gmail.com',
       'member'
from crews c
where c.name = 'BLACKOUT'
on conflict (crew_id, invite_code) do nothing;

-- 이미 줄이 있는데 uuid 만 비어 있던 경우를 메운다
update crew_members m
set user_id = u.id
from auth.users u
where lower(m.email) = lower(u.email)
  and m.user_id is null;

-- ─────────────────────────────────────────── 확인

select '운영 화면 (이메일)' as 구분, email as 주소, note as 메모
from admin_emails order by email;

select '운영 화면 (계정)' as 구분, u.email as 주소,
       '붙음' as 상태
from app_admins a join auth.users u on u.id = a.user_id
order by u.email;

select '크루 스태프' as 구분,
       c.name as 크루,
       m.display_name as 이름,
       m.email as 주소,
       case when m.user_id is null
            then '계정 미연결 — 구글 로그인 한 번 뒤 이 파일 다시 실행'
            else '연결됨' end as 상태
from crew_members m join crews c on c.id = m.crew_id
order by c.name, m.display_name;
