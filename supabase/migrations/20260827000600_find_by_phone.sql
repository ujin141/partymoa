-- 이름 + 연락처로 내 티켓 찾기.
--
-- 지금은 예매번호(PM0001)가 있어야 찾는다. 문자를 지웠거나 기기를 바꾼
-- 사람은 그 번호를 모른다 — 정작 티켓이 필요한 순간에 못 찾는다.
--
-- **연락처만으로는 안 연다.** 번호만 넣으면 남의 번호를 아는 사람이
-- 그 사람이 어느 파티에 가는지, 누구 이름으로 몇 명 예매했는지 다 본다.
-- 파티 앱에서 그건 그냥 사생활이다. 이름을 같이 받으면 예매번호를 외울
-- 필요는 없어지면서 아무나 열지는 못한다.
--
-- 이름은 띄어쓰기·대소문자를 무시하고 맞춘다. "송 우진" 이라고 적었다고
-- 못 찾으면 안 된다.

create or replace function find_bookings_by_phone(p_phone text, p_name text)
returns setof bookings
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name   text := lower(regexp_replace(coalesce(p_name, ''), '\s', '', 'g'));
begin
  if length(v_digits) < 8 then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;
  if length(v_name) < 1 then
    raise exception 'BAD_NAME' using errcode = 'P0001';
  end if;

  return query
  select bk.*
  from bookings bk
  where regexp_replace(bk.phone, '\D', '', 'g') = v_digits
    and lower(regexp_replace(bk.name, '\s', '', 'g')) = v_name
    and bk.status <> 'cancelled'
  order by bk.created_at desc;
end $fn$;

revoke all on function find_bookings_by_phone from public;
grant execute on function find_bookings_by_phone to anon, authenticated;

-- 찾은 걸 지금 세션에 전부 붙인다. 다음부터는 목록에 그냥 뜬다
create or replace function claim_bookings_by_phone(p_phone text, p_name text)
returns setof bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids uuid[];
begin
  select array_agg(bk.id) into v_ids
  from find_bookings_by_phone(p_phone, p_name) bk;

  if v_ids is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if auth.uid() is not null then
    update bookings set user_id = auth.uid()
    where id = any(v_ids) and user_id is null;
  end if;

  return query select bk.* from bookings bk
  where bk.id = any(v_ids) order by bk.created_at desc;
end $fn$;

revoke all on function claim_bookings_by_phone from public;
grant execute on function claim_bookings_by_phone to anon, authenticated;
