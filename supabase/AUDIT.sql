-- ═══════════════════════════════════════════════════════════════════
--  AUDIT — Supabase 보안 어드바이저가 보는 것을 SQL 로 그대로 본다
--
--  아무것도 바꾸지 않는다. 읽기만 한다. 결과를 그대로 복사해서 보내면
--  어디를 더 조여야 하는지 판단한다. 대시보드 Advisors → Security 와
--  같은 항목이고, 거기서 보는 게 더 편하면 그걸 봐도 된다.
--
--  기대값
--   1. RLS 꺼진 표: 0줄
--   2. 정의자 권한 뷰: post_list · comment_list · review_list · crew_faces ·
--      event_stats · tier_stats · review_stats · event_recap 만 (의도한 것)
--   3. search_path 안 잠근 정의자 함수: 0줄
--   4. anon 이 직접 insert/update/delete 할 수 있는 표: 0줄
--   5. anon 이 부를 수 있는 함수: 아래 목록 밖이면 확인
--   6. using (true) 정책: 읽기(select)만 있어야 하고, 쓰기에 있으면 구멍
--   7. create_booking · rate_ok · _rate_hit 권한
-- ═══════════════════════════════════════════════════════════════════

-- 1. RLS 꺼진 표
select '1.RLS꺼짐' as 항목, c.relname as 표
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 2;

-- 2. 정의자 권한 뷰 (security_invoker 가 아닌 뷰). RLS 를 건너뛴다
select '2.정의자뷰' as 항목, c.relname as 뷰,
       coalesce(c.reloptions::text, '') as 옵션
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and not coalesce(c.reloptions::text, '') like '%security_invoker=on%'
  and not coalesce(c.reloptions::text, '') like '%security_invoker=true%'
order by 2;

-- 3. 정의자 함수인데 search_path 를 안 잠근 것
select '3.search_path' as 항목, p.proname as 함수
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not coalesce(array_to_string(p.proconfig, ','), '') like '%search_path%'
order by 2;

-- 4. anon 이 직접 쓸 수 있는 표 (정책이 열려 있어야 실제로 되지만, 권한부터 본다)
select '4.anon쓰기권한' as 항목, table_name as 표,
       string_agg(privilege_type, ',') as 권한
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
group by table_name order by 2;

-- 5. anon 이 부를 수 있는 함수
select '5.anon함수' as 항목, p.oid::regprocedure as 함수
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'execute')
order by 2;

-- 6. using(true) / with check(true) 정책
select '6.true정책' as 항목, tablename as 표, policyname as 정책, cmd as 명령,
       roles::text as 역할
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
order by 2, 3;

-- 7. 핵심 함수 권한. create_booking·rate_ok 는 service_role 만 true 여야 한다
select '7.핵심함수' as 항목, p.oid::regprocedure as 함수, r.rolname as 역할,
       has_function_privilege(r.rolname, p.oid, 'execute') as 가능
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
where n.nspname = 'public'
  and p.proname in ('create_booking', 'rate_ok', '_rate_hit', 'push_targets',
                    'marketing_targets', 'member_list', 'find_user_id')
order by 2, 3;

-- 8. 쓰기 정책 중 with check 가 비어 있는 것 (using 재사용이라 보통 괜찮지만 확인)
select '8.check없음' as 항목, tablename as 표, policyname as 정책, cmd as 명령
from pg_policies
where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'ALL')
  and with_check is null
order by 2, 3;
