-- ═══════════════════════════════════════════════════════════════════
--  예매할 때 인스타 아이디를 같이 받는다
--
--  **NO_DUPE.sql 의 함수 본문을 그대로 두고 인자 하나만 더한 것이다.**
--  중복 예매 검사(ALREADY_BOOKED)가 그대로 살아 있다.
--
--  ⚠ 이 파일의 앞 판(2026-09-04)이 NO_DUPE.sql 보다 **오래된 본문** 위에
--    만들어져 있었다. 그걸 돌린 프로젝트는 중복 검사가 지워진 상태다.
--    이 파일을 돌리면 되돌아온다. 아래 3번 확인 질의로 본다.
--
--  두 번 돌려도 안전하다.
-- ═══════════════════════════════════════════════════════════════════
--
--  ## 왜 받나
--
--  솔로파티는 오는 사람이 서로 처음이다. 크루가 자리를 붙여 주려면 그
--  사람을 볼 게 하나는 있어야 하는데, 이름과 번호로는 아무것도 안 나온다.
--
--  **선택 항목이다.** 필수로 걸면 인스타를 안 쓰는 사람이 예매를 못 한다.
--
--  ## 저장 규칙
--
--  **@ 없이 소문자로만 저장한다.** 앱(app/api/bookings/route.ts)이 주소를
--  통째로 붙여 넣은 것까지 아이디만 남겨서 보낸다. 여기서 한 번 더 씻는
--  이유는 RPC 를 직접 부르는 경우가 있어서다.

-- ─────────────────────────────────────────── 1. 컬럼
alter table bookings add column if not exists instagram text;

comment on column bookings.instagram is
  '인스타 아이디. @ 없이 소문자. 선택 항목이라 비어 있을 수 있다';


-- ─────────────────────────────────────────── 2. create_booking
--
--  **p_instagram 은 맨 뒤에 default null 로 붙인다.** 앞에 끼우면 인자
--  순서가 밀려서, 새 함수가 깔리기 전에 들어온 요청이 엉뚱한 값을 받는다.

create or replace function create_booking(
  p_event_id uuid,
  p_tier_id uuid,
  p_name text,
  p_phone text,
  p_gender text,
  p_quantity int,
  p_invite_code text default null,
  p_instagram text default null
) returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_event events;
  v_tier ticket_tiers;
  v_booked int;
  v_booked_g int;
  v_tier_sold int;
  v_gender_cap int;
  v_price int;
  v_amount int;
  v_invite text;
  v_digits text;
  v_insta text;
  v_row bookings;
begin
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;
  if p_quantity < 1 or p_quantity > 4 then
    raise exception 'BAD_QUANTITY' using errcode = 'P0001';
  end if;

  select * into v_event from events where id = p_event_id for update;
  if not found or v_event.status <> 'open' then
    raise exception 'EVENT_NOT_OPEN' using errcode = 'P0001';
  end if;

  -- **자리 계산보다 먼저 본다.** 뒤로 미루면 이미 예매한 사람에게
  -- "매진됐어요" 가 나간다. 틀린 말이고, 자기 예매를 찾으러 가지도 않는다.
  --
  -- 숫자만 남겨서 비교한다. 010-1234-5678 과 01012345678 이 저장돼
  -- 있는데 문자열로 비교하면 같은 번호가 다른 번호가 된다.
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if v_digits <> '' and exists (
    select 1
    from bookings b
    where b.event_id = p_event_id
      and regexp_replace(b.phone, '[^0-9]', '', 'g') = v_digits
      -- 살아 있는 예매만. 취소한 사람은 다시 잡을 수 있어야 하고,
      -- 24시간이 지나 입금 없이 풀린 건도 자리를 막으면 안 된다
      and (
        b.status in ('paid', 'checked_in')
        or (b.status = 'pending' and b.expires_at > now())
      )
  ) then
    raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
  end if;

  select * into v_tier
  from ticket_tiers where id = p_tier_id and event_id = p_event_id;
  if not found then
    raise exception 'TIER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 크루가 닫은 차수. 자리가 남아 있어도 안 판다
  if v_tier.closed_at is not null then
    raise exception 'TIER_CLOSED' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(quantity) filter (where status <> 'cancelled'), 0),
    coalesce(sum(quantity) filter (where status <> 'cancelled' and gender = p_gender), 0),
    coalesce(sum(quantity) filter (where status <> 'cancelled' and tier_id = p_tier_id), 0)
  into v_booked, v_booked_g, v_tier_sold
  from bookings where event_id = p_event_id;

  if v_booked + p_quantity > v_event.capacity then
    raise exception 'CAPACITY_EXCEEDED:%', v_event.capacity - v_booked
      using errcode = 'P0001';
  end if;

  if v_event.gender_balanced then
    v_gender_cap := floor(v_event.capacity / 2.0);
    if v_booked_g + p_quantity > v_gender_cap then
      raise exception 'GENDER_CAPACITY_EXCEEDED:%', v_gender_cap - v_booked_g
        using errcode = 'P0001';
    end if;
  end if;

  if v_tier_sold + p_quantity > v_tier.capacity then
    raise exception 'TIER_SOLD_OUT:%', v_tier.capacity - v_tier_sold
      using errcode = 'P0001';
  end if;

  v_invite := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  if v_invite is not null and not exists (
    select 1 from crew_members
    where crew_id = v_event.crew_id and invite_code = v_invite
  ) then
    v_invite := null;
  end if;

  -- 앱이 이미 씻어서 보내지만, RPC 를 직접 부르는 경우가 있다.
  -- **형식이 틀리면 막지 않고 버린다** — 선택 항목이라 예매가 우선이다.
  v_insta := nullif(lower(trim(ltrim(coalesce(p_instagram, ''), '@'))), '');
  if v_insta !~ '^[a-z0-9._]{1,30}$' then
    v_insta := null;
  end if;

  v_price := tier_price(v_tier, v_event, p_gender, v_invite is not null);
  v_amount := v_price * p_quantity;

  insert into bookings (
    code, event_id, tier_id, user_id, name, phone, gender,
    quantity, amount, invite_code, instagram, expires_at
  ) values (
    'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
    p_event_id, p_tier_id, auth.uid(), trim(p_name), trim(p_phone), p_gender,
    p_quantity, v_amount, v_invite, v_insta, now() + interval '24 hours'
  ) returning * into v_row;

  return v_row;
end $fn$;


-- ─────────────────────────────────────────── 2b. 옛 함수를 지운다
--
--  **create or replace 는 인자가 하나 늘면 교체가 아니라 함수를 하나 더
--  만든다.** 7개짜리가 남아 있으면 7개로 부를 때 어느 쪽인지 모호해져서
--  PostgREST 가 골라 주지 못하고, 이름만 적은 grant 도 42725 로 죽는다.
drop function if exists create_booking(uuid, uuid, text, text, text, int, text);

-- 인자 목록을 적어서 가리킨다. 나중에 또 인자가 늘어도 안 깨진다
revoke all on function
  create_booking(uuid, uuid, text, text, text, int, text, text) from public;
grant execute on function
  create_booking(uuid, uuid, text, text, text, int, text, text)
  to anon, authenticated;


-- ─────────────────────────────────────────── 2c. 인덱스
--  NO_DUPE.sql 것과 같다. 없으면 만든다
create index if not exists bookings_event_digits_idx
  on bookings (event_id, (regexp_replace(phone, '[^0-9]', '', 'g')));


-- ─────────────────────────────────────────── 3. 확인
--
--  셋 다 참이어야 한다. 함수는 딱 한 줄만 나와야 한다.
select
  (select count(*) from information_schema.columns
    where table_name = 'bookings' and column_name = 'instagram') = 1 as 컬럼있음,
  p.prosrc like '%ALREADY_BOOKED%'  as 중복검사있음,
  p.prosrc like '%p_instagram%'
    or p.prosrc like '%v_insta%'    as 인스타있음,
  p.oid::regprocedure               as 함수
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_booking';


-- ─────────────────────────────────────────── 4. 지금 남은 중복
--
--  중복 검사가 꺼져 있던 동안 들어온 게 있는지 본다. 있으면 크루가
--  직접 판단해서 한 건을 취소한다 — 자동으로 안 지운다. 둘 다
--  입금했으면 환불이 걸린 문제라 사람이 봐야 한다.
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
group by e.title, b.event_id, regexp_replace(b.phone, '[^0-9]', '', 'g')
having count(*) > 1
order by e.title, count(*) desc;
