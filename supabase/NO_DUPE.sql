-- ═══════════════════════════════════════════════════════════════════
--  같은 번호로 두 번 예매하지 못하게 한다
--
--  지금은 같은 사람이 몇 번이든 신청할 수 있습니다. 예매 버튼을 두 번
--  누르면 두 건이 잡히고, 둘 다 24시간 동안 자리를 물고 있습니다.
--  정원이 30명인 파티에서 이건 그냥 자리가 사라지는 일입니다.
--
--  크루 쪽도 곤란합니다. 명단에 같은 이름이 두 줄로 뜨면 입금이 한 건인지
--  두 건인지, 몇 명이 오는 건지 현장에서 확인해야 합니다.
--
--  **번호로 봅니다.** 로그인 없이도 예매를 받기 때문에 user_id 는 비어
--  있을 수 있고, 익명 세션까지 섞이면 같은 기기에서 온 남남을 한 사람으로
--  봅니다. 실제로 한 사람을 가리키는 값은 연락처뿐입니다.
--
--  **user_id 로는 막지 않습니다.** 로그인한 사람이 다른 번호로 한 건 더
--  넣는 건 대개 대신 예매입니다. 성별이 예매 건마다 하나라서, 남녀가 같이
--  오면 어차피 두 건으로 나눠 넣어야 합니다. 그걸 막으면 안 됩니다.
--  번호가 다르면 크루는 두 사람 연락처를 갖게 되니 그쪽이 낫습니다.
--
--  두 번 돌려도 안전합니다.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────── 왜 유니크 인덱스가 아닌가
--
--  "살아 있는 예매" 의 조건에 expires_at > now() 가 들어갑니다. now() 는
--  immutable 이 아니라 부분 인덱스 조건으로 못 씁니다. status <> 'cancelled'
--  로만 걸면 24시간 지나 죽은 pending 이 그 번호를 영영 잠급니다.
--
--  대신 함수가 이미 events 행을 for update 로 잡고 시작합니다. 같은 파티에
--  들어오는 예매는 그 잠금 뒤에 한 줄로 섭니다. 아래 검사도 그 안에 있어서
--  동시에 두 건이 통과하는 일은 없습니다.

create or replace function create_booking(
  p_event_id uuid,
  p_tier_id uuid,
  p_name text,
  p_phone text,
  p_gender text,
  p_quantity int,
  p_invite_code text default null
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

  -- ── 여기가 이번에 붙은 부분 ──
  --
  -- **자리 계산보다 먼저 봅니다.** 뒤로 미루면 이미 예매한 사람에게
  -- "매진됐어요" 가 나갑니다. 틀린 말이고, 자기 예매를 찾으러 가지도
  -- 않습니다.
  --
  -- 숫자만 남겨서 비교합니다. 010-1234-5678 과 01012345678 이 저장돼
  -- 있는데 문자열로 비교하면 같은 번호가 다른 번호가 됩니다.
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

  v_price := tier_price(v_tier, v_event, p_gender, v_invite is not null);
  v_amount := v_price * p_quantity;

  insert into bookings (
    code, event_id, tier_id, user_id, name, phone, gender,
    quantity, amount, invite_code, expires_at
  ) values (
    'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
    p_event_id, p_tier_id, auth.uid(), trim(p_name), trim(p_phone), p_gender,
    p_quantity, v_amount, v_invite, now() + interval '24 hours'
  ) returning * into v_row;

  return v_row;
end $fn$;

revoke all on function create_booking from public;
grant execute on function create_booking to anon, authenticated;

-- ─────────────────────────────────────────── 찾을 때 쓰는 인덱스
--
--  검사가 번호 숫자만 뽑아서 비교하므로 phone 컬럼의 일반 인덱스는
--  안 탑니다. 표현식 그대로 인덱스를 겁니다. 파티 하나에 수십 건이라
--  없어도 돌긴 하지만, 이 질의는 예매 한 건마다 매번 돕니다.

create index if not exists bookings_event_digits_idx
  on bookings (event_id, (regexp_replace(phone, '[^0-9]', '', 'g')));

-- ─────────────────────────────────────────── 이미 들어와 있는 중복
--
--  지금 살아 있는 중복이 있는지 봅니다. 있으면 크루가 직접 판단해서
--  한 건을 취소해야 합니다 — 여기서 자동으로 지우지 않습니다.
--  둘 다 입금했을 수도 있고, 그러면 환불이 걸린 문제라서 사람이
--  봐야 합니다.

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
