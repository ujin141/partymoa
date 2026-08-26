-- 크루 등록이 "가입 먼저" 를 요구하지 않게 한다.
--
-- 지금까지는 crews.owner_id 가 NOT NULL 이라, 대표가 먼저 로그인해서
-- auth 계정을 만들어 둔 뒤에야 크루를 등록할 수 있었다. 크루를 섭외하는
-- 순서가 거꾸로다 — 등록해 놓고 "여기로 들어오세요" 라고 링크를 주는 게
-- 자연스럽다. 실제로 이것 때문에 온보딩이 막혔다.
--
-- 이메일 권한(crew_members.email)이 이미 있으므로, 계정이 없으면
-- owner_id 를 비워 두고 이메일만 적어 둔다. 그 주소로 처음 로그인하는
-- 순간 is_crew_staff() 가 통과시킨다.
alter table crews alter column owner_id drop not null;

comment on column crews.owner_id is
  '대표 계정. 아직 가입 전이면 비어 있고, crew_members.email 로 권한이 간다';

-- 운영자가 크루를 등록할 때 대표 멤버 한 줄을 같이 넣는다.
-- crew_members_write 는 "그 크루의 owner" 만 통과시키는데, 갓 만든 크루는
-- owner 가 비어 있거나 운영자 본인이 아니라 막힌다. 운영자 통로를 하나 낸다.
drop policy if exists crew_members_admin_write on crew_members;
create policy crew_members_admin_write on crew_members
  for all using (is_app_admin()) with check (is_app_admin());
