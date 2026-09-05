-- ═══════════════════════════════════════════════════════════════════
--  같은 번호로 두 번 예매하지 못하게 한다
--
--  ⚠ **함수는 여기 없다. INSTAGRAM.sql 을 돌려라.**
--
--  처음 이 파일이 create_booking(인자 7개) 을 통째로 다시 정의했다.
--  그 뒤 INSTAGRAM.sql 이 같은 본문에 p_instagram 을 하나 더 붙여
--  인자 8개짜리로 만들고 7개짜리를 지웠다. 중복 검사(ALREADY_BOOKED)는
--  그쪽에 그대로 들어 있다.
--
--  그 상태에서 이 파일의 옛 정의를 다시 돌리면 **7개짜리가 하나 더
--  생긴다.** create or replace 는 인자 목록이 다르면 교체가 아니라
--  추가다. 둘이 나란히 있으면 이름만 적은 grant/revoke 가 42725 로
--  죽고, PostgREST 는 7개로 부를 때 어느 쪽인지 못 고른다. 앱은 8개로
--  부르니 중복 검사가 없는 쪽으로 빠질 일은 없지만, 어쨌든 두 벌이
--  남는 건 사고의 씨앗이다. 그래서 함수 정의를 여기서 뺐다.
--
--  남긴 것은 둘이다. 둘 다 몇 번을 돌려도 안전하다.
--
--    1. 검사가 타는 표현식 인덱스 (INSTAGRAM.sql 에도 있다)
--    2. 지금 살아 있는 중복을 뽑는 질의
--
--  ## 왜 번호로 보나
--
--  로그인 없이도 예매를 받기 때문에 user_id 는 비어 있을 수 있고, 익명
--  세션까지 섞이면 같은 기기에서 온 남남을 한 사람으로 본다. 한 사람을
--  실제로 가리키는 값은 연락처뿐이다.
--
--  user_id 로는 막지 않는다. 로그인한 사람이 다른 번호로 한 건 더 넣는
--  건 대개 대신 예매다. 성별이 예매 건마다 하나라서 남녀가 같이 오면
--  어차피 두 건으로 나눠야 한다. 그걸 막으면 안 된다.
--
--  ## 왜 유니크 인덱스가 아닌가
--
--  "살아 있는 예매" 조건에 expires_at > now() 가 들어간다. now() 는
--  immutable 이 아니라 부분 인덱스 조건으로 못 쓴다. status <> 'cancelled'
--  로만 걸면 24시간 지나 죽은 pending 이 그 번호를 영영 잠근다.
--
--  대신 함수가 events 행을 for update 로 잡고 시작한다. 같은 파티 예매는
--  그 잠금 뒤에 한 줄로 서고 검사도 그 안에 있어서, 동시에 두 건이
--  통과하는 일은 없다.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────── 1. 인덱스
--
--  검사가 번호에서 숫자만 뽑아 비교하므로 phone 컬럼의 일반 인덱스는
--  안 탄다. 표현식 그대로 건다.

create index if not exists bookings_event_digits_idx
  on bookings (event_id, (regexp_replace(phone, '[^0-9]', '', 'g')));

-- ─────────────────────────────────────────── 2. 이미 들어와 있는 중복
--
--  있으면 크루가 직접 보고 한 건을 취소한다. 여기서 자동으로 지우지
--  않는다. 둘 다 입금했을 수도 있고, 그러면 환불이 걸린 문제라 사람이
--  봐야 한다.

select
  e.title as "파티",
  max(b.phone) as "연락처",
  count(*) as "예매 건수",
  string_agg(b.code || ' (' || b.status || ', ' || b.quantity || '명)', ', '
             order by b.created_at) as "건별"
from bookings b
join events e on e.id = b.event_id
where b.status in ('paid', 'checked_in')
   or (b.status = 'pending' and b.expires_at > now())
-- 검사와 같은 기준으로 묶는다. phone 그대로 묶으면 010-1234-5678 과
-- 01012345678 이 서로 다른 사람으로 갈려서 중복이 안 잡힌다
group by e.title, b.event_id, regexp_replace(b.phone, '[^0-9]', '', 'g')
having count(*) > 1
order by e.title, count(*) desc;

-- ─────────────────────────────────────────── 3. 함수가 맞게 들어 있나
--
--  8개짜리 하나만 있어야 하고, 그 본문에 ALREADY_BOOKED 가 있어야 한다.

select pg_get_function_identity_arguments(p.oid) as "인자",
       p.prosrc like '%ALREADY_BOOKED%' as "중복검사"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_booking';
