-- ═══════════════════════════════════════════════════════════════════
--  운영 화면을 내 계정만 열리게 잠근다
--
--  운영자는 **전 크루의 손님 명단과 매출**을 본다. 크루보다 위 권한이라
--  여기에 남이 들어 있으면 그게 제일 큰 사고다.
--
--  ⬛ 아래 두 줄만 확인하세요. 여기 적힌 주소 말고는 전부 지웁니다.
-- ═══════════════════════════════════════════════════════════════════

create temp table if not exists _keep (email text primary key);
truncate _keep;
insert into _keep (email) values
  ('ujin141@naver.com'),        -- ⬛ 이메일/비밀번호 계정
  ('⬛구글주소@gmail.com');      -- ⬛ 운영 화면에 쓰는 구글 계정

-- ─────────────────────────────────────────── 지금 누가 운영자인가

select '지금 운영자 (이메일)' as 구분, email as 주소, note as 메모
from admin_emails order by email;

select '지금 운영자 (계정)' as 구분, u.email as 주소, a.note as 메모
from app_admins a join auth.users u on u.id = a.user_id;

-- ─────────────────────────────────────────── 잠근다

do $lock$
declare
  v_left int;
  v_bad  text[];
begin
  if exists (select 1 from _keep where email like '%⬛%') then
    raise warning '구글 주소를 아직 안 채웠습니다. 위 ⬛ 줄을 고치고 다시 돌리세요.';
    return;
  end if;

  -- 이메일 권한 — 남길 주소 말고 전부
  select array_agg(email) into v_bad
  from admin_emails
  where lower(email) not in (select lower(email) from _keep);
  delete from admin_emails
  where lower(email) not in (select lower(email) from _keep);
  if v_bad is not null then
    raise notice '이메일 권한에서 뺐습니다: %', v_bad;
  end if;

  -- 남길 주소는 있어야 한다. 없으면 구글로 들어갔을 때 못 들어간다
  insert into admin_emails (email, note)
  select lower(email), '운영자' from _keep
  on conflict (email) do nothing;

  -- uuid 권한 — 남길 주소의 계정만
  v_bad := null;
  select array_agg(u.email) into v_bad
  from app_admins a join auth.users u on u.id = a.user_id
  where lower(u.email) not in (select lower(email) from _keep);

  delete from app_admins a
  where not exists (
    select 1 from auth.users u
    where u.id = a.user_id
      and lower(u.email) in (select lower(email) from _keep)
  );
  if v_bad is not null then
    raise notice '계정 권한에서 뺐습니다: %', v_bad;
  end if;

  select count(*) into v_left from admin_emails;
  if v_left = 0 then
    raise exception '운영자가 하나도 안 남습니다. 되돌립니다.';
  end if;
end $lock$;

-- ─────────────────────────────────────────── 잠근 뒤

select '남은 운영자' as 구분, email as 주소 from admin_emails order by email;

select '남은 운영자 계정' as 구분, u.email as 주소
from app_admins a join auth.users u on u.id = a.user_id;

-- 크루 권한은 따로다. 여기 있는 사람은 자기 크루만 본다 — 정상입니다
select '크루 스태프 (참고)' as 구분, c.name as 크루,
       m.display_name as 이름, m.email as 주소, m.role as 역할
from crew_members m join crews c on c.id = m.crew_id
order by c.name, m.display_name;
