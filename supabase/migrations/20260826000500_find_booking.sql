-- 예매번호 + 연락처로 내 티켓 찾기.
--
-- 로그인 없이 예매를 받으므로(첫 목표가 "링크로 들어와 예매"다) 기기를
-- 바꾸거나 쿠키가 지워지면 티켓을 못 찾는다. 둘 다 맞아야만 한 건을
-- 돌려주는 함수를 둔다 — 번호만으로는 남의 티켓을 못 본다.

create or replace function find_booking(p_code text, p_phone text)
returns bookings
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_row bookings;
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 8 then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;

  select * into v_row from bookings
  where upper(trim(code)) = upper(trim(p_code))
    and regexp_replace(phone, '\D', '', 'g') = v_digits
    and status <> 'cancelled';

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_row;
end $fn$;

revoke all on function find_booking from public;
grant execute on function find_booking to anon, authenticated;

-- 찾은 티켓을 지금 세션에 붙인다. 다음부터는 목록에 그냥 뜬다
create or replace function claim_booking(p_code text, p_phone text)
returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row bookings;
begin
  v_row := find_booking(p_code, p_phone);
  if auth.uid() is null then
    return v_row;
  end if;
  update bookings set user_id = auth.uid()
  where id = v_row.id and user_id is null
  returning * into v_row;
  if v_row.id is null then
    v_row := find_booking(p_code, p_phone);
  end if;
  return v_row;
end $fn$;

revoke all on function claim_booking from public;
grant execute on function claim_booking to anon, authenticated;
