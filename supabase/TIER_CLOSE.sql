-- ═══════════════════════════════════════════════════════════════════
--  차수를 손으로 닫는다
--
--  **끝난 차수가 혼자 다시 열리는 일이 있었습니다.**
--
--  지금까지 "이 차수가 끝났나" 를 정원으로만 판단했습니다. 2차가
--  22자리 중 22자리 다 나가서 끝났는데, 그중 한 건이 취소되자
--  21/22 가 되면서 다시 파는 차수가 됐습니다. 홈 화면 가격이
--  59,000원에서 49,000원으로 돌아가고 "17% 할인" 까지 붙었습니다.
--
--  자리 수와 "판다/안 판다" 는 다른 이야기입니다. 그래서 칸을
--  하나 더 둡니다. 크루가 닫으면 자리가 남아도 안 팝니다.
--
--  두 번 돌려도 안전합니다.
-- ═══════════════════════════════════════════════════════════════════

alter table ticket_tiers add column if not exists closed_at timestamptz;

-- ─────────────────────────────────────────── 서버도 막는다
--
--  화면에서 회색으로 만들어 두는 것으로는 부족합니다. 낡은 화면을
--  띄워 둔 사람이나 API 를 직접 부르는 쪽은 그대로 통과합니다.

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

-- ─────────────────────────────────────────── AFTER SUNSET
--
--  1차·2차는 끝났습니다. 3차만 받습니다.

update ticket_tiers t
set closed_at = coalesce(t.closed_at, now())
from events e
where e.id = t.event_id
  and e.slug = 'after-sunset-20260829'
  and t.name in ('1차 얼리버드', '2차 사전예매');

-- ─────────────────────────────────────────── 확인

select t.sort_order   as 순서,
       t.name         as 차수,
       t.price        as 여,
       t.male_price   as 남,
       s.sold || '/' || t.capacity as 판매,
       case when t.closed_at is not null then '마감'
            when s.sold >= t.capacity   then '정원참'
            else '판매중' end as 상태
from ticket_tiers t
join events e on e.id = t.event_id
join tier_stats s on s.tier_id = t.id
where e.slug = 'after-sunset-20260829'
order by t.sort_order;
