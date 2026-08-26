-- 추천인을 나중에 고칠 수 있게. Supabase SQL 편집기에 통째로 붙여 넣고 실행.
--
-- ## 왜 필요한가
--
-- 게스트가(30,000)를 붙이기 전에 들어온 예매가 있다. 그 사람들은 49,000
-- 으로 잡혀 있고, 추천인도 안 붙어 있다. **앱에서 고칠 방법이 없었다.**
--
-- 그리고 이건 한 번 쓰고 버릴 문제가 아니다. 29일 입구에서 "저 아무개
-- 게스트인데요" 하는 사람은 반드시 나온다. 그때 크루가 손으로 계좌를
-- 다시 계산하는 대신 코드만 넣으면 되게 한다.

-- ─────────────────────────────────────────── 1. 코드를 안 버린다
--
-- 지금까지는 멤버 목록에 없는 코드를 **조용히 null 로 만들었다.** 그래서
-- 손님이 추천인을 적어도, 그 크루원을 나중에 등록하면 그 예매는 영영
-- 그 사람 몫이 안 된다. 실제로 그렇게 한 건이 사라졌다.
--
-- 이제는 적힌 대로 남긴다. 다만 **게스트가는 확인된 코드에만** 준다 —
-- 오타로 3만원이 되면 안 된다. 크루는 명단에서 그 코드를 보고 고친다.

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
  v_invite text;
  v_known boolean := false;
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

  select * into v_tier
  from ticket_tiers where id = p_tier_id and event_id = p_event_id;
  if not found then
    raise exception 'TIER_NOT_FOUND' using errcode = 'P0001';
  end if;

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
  if v_invite is not null then
    select exists (
      select 1 from crew_members
      where crew_id = v_event.crew_id and invite_code = v_invite
    ) into v_known;
  end if;

  -- 코드는 적힌 대로 남기고, 할인은 확인된 것에만
  v_price := tier_price(v_tier, v_event, p_gender, v_known);

  insert into bookings (
    code, event_id, tier_id, user_id, name, phone, gender,
    quantity, amount, invite_code, expires_at
  ) values (
    'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
    p_event_id, p_tier_id, auth.uid(), trim(p_name), trim(p_phone), p_gender,
    p_quantity, v_price * p_quantity, v_invite, now() + interval '24 hours'
  ) returning * into v_row;

  return v_row;
end $fn$;

revoke all on function create_booking from public;
grant execute on function create_booking to anon, authenticated;

-- ─────────────────────────────────────────── 2. 나중에 고치기
--
-- 크루가 **금액을 직접 적지 않는다.** 코드만 넣으면 금액은 tier_price 가
-- 다시 계산한다. 손으로 적게 두면 정산이 어긋나고, 어긋난 걸 나중에
-- 아무도 못 찾는다.
--
-- 이미 입금이 끝난 건도 고칠 수 있어야 한다 — 게스트인 걸 뒤늦게 알고
-- 차액을 돌려주는 경우가 그렇다. 대신 얼마가 바뀌었는지 돌려준다.

create or replace function set_booking_invite(
  p_booking uuid,
  p_code text
) returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row   bookings;
  v_event events;
  v_tier  ticket_tiers;
  v_code  text := nullif(upper(trim(coalesce(p_code, ''))), '');
  v_known boolean := false;
  v_price int;
begin
  select * into v_row from bookings where id = p_booking;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- security definer 라 RLS 가 안 걸린다. 권한을 여기서 직접 본다
  if not is_event_staff(v_row.event_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_event from events where id = v_row.event_id;
  select * into v_tier from ticket_tiers where id = v_row.tier_id;

  if v_code is not null then
    select exists (
      select 1 from crew_members
      where crew_id = v_event.crew_id and invite_code = v_code
    ) into v_known;
    if not v_known then
      raise exception 'UNKNOWN_CODE' using errcode = 'P0001';
    end if;
  end if;

  v_price := tier_price(v_tier, v_event, v_row.gender, v_known);

  update bookings
     set invite_code = v_code,
         amount = v_price * quantity
   where id = p_booking
  returning * into v_row;

  return v_row;
end $fn$;

revoke all on function set_booking_invite from public;
grant execute on function set_booking_invite to authenticated;

-- ─────────────────────────────────────────── 3. 이미 들어온 건 확인
--
-- 게스트가를 붙이기 전에 들어온 예매 중 추천인이 적힌 것들.
-- 아래를 돌려 보고, 고칠 건은 앱 명단에서 [추천인] 을 눌러 코드를 넣는다.

select b.code, b.name, b.gender, b.quantity, b.amount, b.invite_code,
       t.name as tier, b.status, b.created_at
from bookings b
join ticket_tiers t on t.id = b.tier_id
where b.status <> 'cancelled'
order by b.created_at desc
limit 50;

-- ─────────────────────────────────────────── 4. 일괄 정정 (선택)
--
-- **일부러 주석으로 둔다.** 실제 손님의 결제 금액을 한 번에 바꾸는
-- 문장이라, 위 목록을 눈으로 보고 나서 직접 풀어서 돌려야 한다.
--
-- 추천인이 적혀 있는데 게스트가보다 비싸게 잡힌 건들을 30,000 으로
-- 맞춘다. 이미 입금이 끝난 사람은 차액을 돌려줘야 하므로, 먼저
-- 아래 select 로 누가 얼마를 돌려받는지 확인한다.
--
-- select b.code, b.name, b.amount as 받은금액,
--        tier_price(t, e, b.gender, true) * b.quantity as 바뀔금액,
--        b.amount - tier_price(t, e, b.gender, true) * b.quantity as 돌려줄금액,
--        b.status
-- from bookings b
-- join ticket_tiers t on t.id = b.tier_id
-- join events e on e.id = b.event_id
-- where b.status <> 'cancelled'
--   and b.invite_code is not null
--   and e.guest_price is not null
--   and b.amount > tier_price(t, e, b.gender, true) * b.quantity;
--
-- 확인했으면 이걸 돌린다.
--
-- update bookings b
--    set amount = tier_price(t, e, b.gender, true) * b.quantity
--   from ticket_tiers t, events e
--  where t.id = b.tier_id
--    and e.id = b.event_id
--    and b.status <> 'cancelled'
--    and b.invite_code is not null
--    and e.guest_price is not null
--    and b.amount > tier_price(t, e, b.gender, true) * b.quantity;
--
-- **추천인이 안 적힌 건은 여기서 안 잡힌다.** 코드가 예매 때 버려졌기
-- 때문이다. 그건 앱 명단에서 [추천인] 을 눌러 하나씩 넣어야 한다.
