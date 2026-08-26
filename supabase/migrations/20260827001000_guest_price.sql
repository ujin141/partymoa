-- 초대 코드 = 게스트가.
--
-- **지금까지 초대 코드는 금액을 안 바꿨다.** 누가 데려왔는지 집계에만
-- 썼다. 그런데 실제로는 DJ 게스트가 30,000원, 그냥 온 사람이 49,000원
-- 이다 — 그 차이를 크루가 손으로 고쳐 왔다.
--
-- 그러면 손님은 앱에서 49,000원을 보고 예매한 뒤 "게스트인데요" 라고
-- DM 을 보내야 한다. 그걸 앱이 하게 만든다.
--
-- 비워 두면 예전과 똑같다 — 코드는 집계에만 쓰이고 금액은 안 바뀐다.
alter table events add column if not exists guest_price int
  check (guest_price is null or guest_price >= 0);

comment on column events.guest_price is
  '유효한 초대 코드를 넣었을 때의 금액. 비우면 할인 없음';

-- **옛 3인자짜리를 먼저 지운다.** 기본값이 있는 4인자와 나란히 두면
-- tier_price(t, e, 'M') 이 어느 쪽인지 모호해져서 예매가 통째로 막힌다
drop function if exists tier_price(ticket_tiers, events, text);

-- 금액 계산의 단일 진실. 초대가 있으면 게스트가가 이긴다
create or replace function tier_price(
  p_tier ticket_tiers,
  p_event events,
  p_gender text,
  p_invited boolean default false
)
returns int language sql immutable as $$
  select case
    when p_invited and p_event.guest_price is not null then p_event.guest_price
    when p_gender <> 'M' then p_tier.price
    when p_tier.male_price is not null then p_tier.male_price
    else (round(p_tier.price * p_event.male_price_multiplier / 1000.0) * 1000)::int
  end;
$$;

-- 손님이 코드를 넣는 순간 금액이 바뀌어야 한다. 그러려면 화면이 코드를
-- 물어볼 자리가 필요하다. **크루 정보는 안 준다** — 코드가 맞는지와
-- 얼마인지만 준다
create or replace function check_invite(p_event uuid, p_code text)
returns table (valid boolean, price int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_event  events;
  v_code   text := nullif(upper(trim(coalesce(p_code, ''))), '');
  v_ok     boolean := false;
begin
  select * into v_event from events where id = p_event;
  if not found then
    return query select false, null::int;
    return;
  end if;

  if v_code is not null then
    select exists (
      select 1 from crew_members m
      where m.crew_id = v_event.crew_id and m.invite_code = v_code
    ) into v_ok;
  end if;

  return query select v_ok, case when v_ok then v_event.guest_price else null end;
end $fn$;

revoke all on function check_invite from public;
grant execute on function check_invite to anon, authenticated;
