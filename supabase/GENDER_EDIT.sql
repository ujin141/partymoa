-- 명단에서 성별을 고칠 수 있게. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- 오늘만 성별을 SQL 로 두 번 고쳤다. 현장에서는 "성별 잘못 눌렀어요" 가
-- 반드시 나오는데, 그때마다 노트북을 열 수는 없다.
--
-- ## 금액을 같이 바꿀지는 크루가 정한다
--
-- 성별이 바뀌면 가격이 달라질 수 있다(남성가). 그런데 이미 그 금액으로
-- 입금이 끝난 사람이 있다 — 자동으로 바꾸면 받은 돈과 기록이 어긋난다.
-- 그래서 p_reprice 를 따로 받는다. 화면이 "금액도 바꿀까요" 를 묻는다.
--
-- 성비 정원을 넘어도 **막지 않는다.** 크루는 사실을 바로잡는 중이고,
-- 이미 받은 예매를 되돌리는 건 다른 판단이다.

create or replace function set_booking_gender(
  p_booking uuid,
  p_gender text,
  p_reprice boolean default false
) returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row   bookings;
  v_event events;
  v_tier  ticket_tiers;
  v_price int;
begin
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;

  select * into v_row from bookings where id = p_booking;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- security definer 라 RLS 가 안 걸린다. 권한을 여기서 직접 본다
  if not is_event_staff(v_row.event_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_reprice then
    select * into v_event from events where id = v_row.event_id;
    select * into v_tier from ticket_tiers where id = v_row.tier_id;
    v_price := tier_price(v_tier, v_event, p_gender, v_row.invite_code is not null);
    update bookings
       set gender = p_gender, amount = v_price * quantity
     where id = p_booking
    returning * into v_row;
  else
    update bookings set gender = p_gender where id = p_booking
    returning * into v_row;
  end if;

  return v_row;
end $fn$;

revoke all on function set_booking_gender from public;
grant execute on function set_booking_gender to authenticated;
