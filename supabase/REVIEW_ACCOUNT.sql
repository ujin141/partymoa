-- 앱 심사용 계정에 호스트 권한을 준다.
--
-- **먼저 Supabase 대시보드에서 계정을 만들어야 한다.**
--   Authentication → Users → Add user
--   · 이메일  review@partymoa.com   (실제 수신 안 해도 된다)
--   · 비밀번호는 길게
--   · **Auto Confirm User 를 켤 것** — 안 켜면 메일 인증을 못 해
--     로그인이 안 되고, 심사자가 또 막힌다
--
-- 그다음 이걸 돌린다. 크루원으로 넣으면 is_crew_staff 가 통과해서
-- 호스트 화면(명단·입금·입장·정산)이 열린다.
--
-- ## 왜 owner_id 를 안 건드리나
--
-- 대표 계정을 심사용으로 바꾸면 **진짜 대표가 자기 크루에서 밀려난다.**
-- 크루원으로만 넣으면 권한은 같고 대표는 그대로다.

do $review$
declare
  v_user uuid;
  v_crew uuid;
begin
  select id into v_user from auth.users where email = 'review@partymoa.com';
  if v_user is null then
    raise exception '심사용 계정이 없습니다. Supabase 에서 먼저 만들어 주세요 (Auto Confirm 켜기).';
  end if;

  select crew_id into v_crew from events order by starts_at desc limit 1;
  if v_crew is null then
    raise exception '크루를 못 찾았습니다.';
  end if;

  insert into crew_members (crew_id, user_id, display_name, invite_code)
  values (v_crew, v_user, 'App Review', 'REVIEW')
  on conflict (crew_id, invite_code)
    do update set user_id = excluded.user_id;

  raise notice '심사 계정에 호스트 권한을 붙였습니다.';
end $review$;

-- ─────────────────────────────────────────── 확인
select m.display_name, m.invite_code, (m.user_id is not null) as 로그인연결
from crew_members m where m.invite_code = 'REVIEW';

-- ─────────────────────────────────────────── 심사가 끝나면
--
-- 그대로 두면 그 계정으로 손님 명단과 연락처를 계속 볼 수 있다.
-- 승인 나면 아래를 돌려서 권한을 뗄 것.
--
-- delete from crew_members where invite_code = 'REVIEW';
