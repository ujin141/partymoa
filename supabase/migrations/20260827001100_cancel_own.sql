-- 손님이 자기 예매를 취소한다.
--
-- 지금은 크루에게 DM 을 보내야 취소된다. 그동안 그 자리는 잠겨 있고,
-- 24시간이 지나야 자동으로 풀린다 — 마감 직전이면 그 하루가 아깝다.
--
-- **입금한 건은 손님이 못 지운다.** 환불이 얽혀 있어서 크루가 확인하고
-- 처리해야 한다. 미입금만 손님이 바로 뺀다 — 어차피 곧 자동 취소될
-- 건이고, 먼저 빼 주면 자리가 그만큼 빨리 돈다.
--
-- 입장까지 한 건은 어느 쪽도 못 지운다. 현장 기록이다.

create or replace function cancel_my_booking(p_booking uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row bookings;
begin
  select * into v_row from bookings where id = p_booking;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_row.user_id is null or v_row.user_id <> auth.uid() then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
  if v_row.status = 'cancelled' then
    return v_row;
  end if;
  if v_row.status = 'checked_in' then
    raise exception 'ALREADY_IN' using errcode = 'P0001';
  end if;
  if v_row.status = 'paid' then
    raise exception 'PAID' using errcode = 'P0001';
  end if;

  update bookings set status = 'cancelled'
  where id = p_booking
  returning * into v_row;
  return v_row;
end $fn$;

revoke all on function cancel_my_booking from public;
grant execute on function cancel_my_booking to anon, authenticated;
