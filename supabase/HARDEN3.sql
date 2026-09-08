-- ═══════════════════════════════════════════════════════════════════
--  HARDEN3 — 5라운드: 돈·쿠폰·현장 흐름
--
--  HARDEN2.sql 다음에 한 번 돌린다. 몇 번 돌려도 같은 결과다.
--
--  잡힌 것
--   1. 입장 처리(checked_in)하는 순간 안 쓴 쿠폰이 전부 지워졌다.
--      트리거가 'paid' 만 쿠폰 있는 상태로 봤다. 바에서 터질 버그.
--   2. 취소·미입금 예매의 쿠폰(한 장이라도 쓴 것)이 계속 쓰였다.
--   3. 크루 화면에서 취소된 예매를 다시 '입금 확인' 누르면 정원 검사
--      없이 되살아났다 (크론이 막 취소한 줄을 보고 누르는 경우).
--   4. 성별 고치며 금액 다시 계산할 때, 없어진 초대 코드도 게스트가로 쳤다.
--   5. 만료됐지만 크론이 아직 안 돌아 취소가 안 된 예매가 정원을 두 번 먹었다.
--   6. 이름+번호 조회가 예매 줄을 통째로 돌려줬다 — 인스타·성별·초대코드·
--      계정 uuid 까지. 이름과 번호를 아는 사람이면 다 봤다.
--   7. 세션 없이 예매 라우트를 부르면 계정당 미입금 상한이 안 걸렸다.
--   8. 남성 배수에 제한이 없어 음수·거대값이 들어가면 예매가 500 으로 죽었다.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────── 1·2. 쿠폰은 입금 뒤부터 입장까지

create or replace function issue_perks(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_b bookings;
begin
  select * into v_b from bookings where id = p_booking;
  -- 입장한 사람도 쿠폰이 있어야 한다. 입장 처리는 입금 뒤에 오는 상태다
  if not found or v_b.status not in ('paid', 'checked_in') then
    return;
  end if;

  insert into booking_perks (booking_id, perk_id, total)
  select v_b.id, p.id,
         case when p.per_person then p.qty * greatest(v_b.quantity, 1)
              else p.qty end
  from event_perks p
  where p.event_id = v_b.event_id
    and (p.table_only = false or v_b.table_id is not null)
  on conflict (booking_id, perk_id) do update
    set total = greatest(excluded.total, booking_perks.used);
end $fn$;

revoke all on function issue_perks from public;

create or replace function bookings_perks_sync() returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status in ('paid', 'checked_in') then
    perform issue_perks(new.id);
  else
    -- 입금을 되돌리거나 취소하면 안 쓴 쿠폰은 회수한다. 쓴 건 안 지운다 —
    -- 이미 마신 잔을 없던 일로 만들면 바와 정산이 안 맞는다
    delete from booking_perks where booking_id = new.id and used = 0;
  end if;
  return new;
end $fn$;

-- 쓴 게 있어서 남은 줄은 use_perk 가 막는다
create or replace function use_perk(p_id uuid)
returns booking_perks
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row  booking_perks;
  v_b    bookings;
  v_e    events;
  v_crew boolean;
begin
  select * into v_row from booking_perks where id = p_id for update;
  if not found then
    raise exception '쿠폰을 찾을 수 없어요.';
  end if;

  select * into v_b from bookings where id = v_row.booking_id;
  select * into v_e from events where id = v_b.event_id;
  v_crew := is_crew_staff(v_e.crew_id);

  if not v_crew and (v_b.user_id is null or v_b.user_id <> auth.uid()) then
    raise exception '본인 쿠폰만 쓸 수 있어요.';
  end if;
  -- 취소됐거나 입금이 되돌려진 예매의 남은 쿠폰은 안 된다
  if v_b.status not in ('paid', 'checked_in') then
    raise exception '입금 확인된 예매의 쿠폰만 쓸 수 있어요.';
  end if;
  if v_row.used >= v_row.total then
    raise exception '이미 다 쓴 쿠폰이에요.';
  end if;
  if not v_crew and (now() < v_e.starts_at - interval '6 hours'
                     or now() > v_e.ends_at + interval '12 hours') then
    raise exception '파티 당일에 쓸 수 있어요.';
  end if;

  update booking_perks
  set used = used + 1,
      first_used_at = coalesce(first_used_at, now()),
      last_used_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end $fn$;

-- 입장 처리로 이미 쿠폰을 잃은 사람이 있으면 여기서 되살린다
select issue_perks(b.id)
from bookings b
where b.status = 'checked_in'
  and not exists (select 1 from booking_perks bp where bp.booking_id = b.id)
  and exists (select 1 from event_perks p where p.event_id = b.event_id);

-- ─────────────────────────────────────────── 3. 취소된 예매는 안 되살아난다
--
--  되살리면 정원·성비·차수 검사를 하나도 안 거친다. 다시 받으려면 크루가
--  손으로 새로 넣는다(add_booking_manual) — 그 길은 검사를 거친다.

create or replace function _bookings_no_revive()
returns trigger
language plpgsql
as $fn$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'CANCELLED_IS_FINAL' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists bookings_no_revive on bookings;
create trigger bookings_no_revive
  before update of status on bookings
  for each row execute function _bookings_no_revive();

-- ─────────────────────────────────────────── 4. 성별 고칠 때 초대 코드는 다시 확인

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
  v_known boolean;
begin
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;

  select * into v_row from bookings where id = p_booking;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not is_event_staff(v_row.event_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_reprice then
    select * into v_event from events where id = v_row.event_id;
    select * into v_tier from ticket_tiers where id = v_row.tier_id;
    -- 적혀 있다고 게스트가 아니다. 지금 크루에 있는 코드만 친다
    v_known := v_row.invite_code is not null and exists (
      select 1 from crew_members m
      where m.crew_id = v_event.crew_id and m.invite_code = v_row.invite_code
    );
    v_price := tier_price(v_tier, v_event, p_gender, v_known);
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

-- ─────────────────────────────────────────── 5·7. 예매 생성
--
--  HARDEN2 의 것에 둘을 더한다.
--   · 세션 없는 호출은 거절 (NO_SESSION). 앱은 항상 세션을 만든다
--   · 자리 계산 전에 만료된 미입금 예매를 먼저 취소한다. 크론이 10분마다
--     도는 사이에 죽은 예매가 정원을 먹고 있었다

create or replace function create_booking(
  p_event_id uuid,
  p_tier_id uuid,
  p_name text,
  p_phone text,
  p_gender text,
  p_quantity int,
  p_invite_code text default null,
  p_instagram text default null,
  p_user_id uuid default null
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
  v_uid uuid := coalesce(p_user_id, auth.uid());
begin
  if v_uid is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;
  if p_quantity < 1 or p_quantity > 4 then
    raise exception 'BAD_QUANTITY' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_name, ''))) < 1 or length(p_name) > 40 then
    raise exception 'BAD_NAME' using errcode = 'P0001';
  end if;

  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if not (
    (left(trim(coalesce(p_phone, '')), 1) = '+' and length(v_digits) between 8 and 15)
    or v_digits ~ '^0[0-9]{8,10}$'
  ) then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;

  select * into v_event from events where id = p_event_id for update;
  if not found or v_event.status <> 'open' then
    raise exception 'EVENT_NOT_OPEN' using errcode = 'P0001';
  end if;

  -- 죽은 예매를 먼저 치운다. 아래 합계가 산 예매만 세게
  update bookings set status = 'cancelled'
  where event_id = p_event_id and status = 'pending' and expires_at < now();

  if exists (
    select 1
    from bookings b
    where b.event_id = p_event_id
      and regexp_replace(b.phone, '[^0-9]', '', 'g') = v_digits
      and b.status <> 'cancelled'
  ) then
    raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
  end if;

  if (
    select count(*) from bookings b
    where b.user_id = v_uid and b.status = 'pending' and b.expires_at > now()
  ) >= 2 then
    raise exception 'PENDING_CAP' using errcode = 'P0001';
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
  if v_invite is not null and not exists (
    select 1 from crew_members
    where crew_id = v_event.crew_id and invite_code = v_invite
  ) then
    v_invite := null;
  end if;

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
    p_event_id, p_tier_id, v_uid, trim(p_name), trim(p_phone), p_gender,
    p_quantity, v_amount, v_invite, v_insta, now() + interval '24 hours'
  ) returning * into v_row;

  return v_row;
end $fn$;

do $do$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_booking'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $do$;

-- ─────────────────────────────────────────── 6. 조회는 필요한 칸만 돌려준다
--
--  이름+번호로 찾으면 그 사람이 보는 건 티켓이다: 번호·상태·금액·인원·
--  마감. 인스타·성별·초대코드·계정 uuid·전화번호는 안 준다 — 번호는
--  본인이 쳤으니 알 필요 없고, 나머지는 남이 알 이유가 없다.
--
--  돌려주는 모양이 바뀌므로 네 함수를 지우고 다시 만든다.

drop function if exists claim_booking(text, text);
drop function if exists claim_bookings_by_phone(text, text);
drop function if exists find_booking(text, text);
drop function if exists find_bookings_by_phone(text, text);
drop type if exists ticket_view;

create type ticket_view as (
  id uuid,
  code text,
  event_id uuid,
  tier_id uuid,
  name text,
  quantity int,
  amount int,
  status text,
  expires_at timestamptz,
  paid_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz
);

create or replace function _ticket_of(b bookings)
returns ticket_view
language sql
immutable
as $fn$
  select (b.id, b.code, b.event_id, b.tier_id, b.name, b.quantity, b.amount,
          b.status, b.expires_at, b.paid_at, b.checked_in_at, b.created_at)::ticket_view;
$fn$;

create or replace function find_bookings_by_phone(p_phone text, p_name text)
returns setof ticket_view
language plpgsql
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
  if not _rate_hit('find:phone:' || v_digits, 6, 600)
     or not _rate_hit('find:all', 60, 60) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  return query
  select _ticket_of(bk)
  from bookings bk
  where regexp_replace(bk.phone, '\D', '', 'g') = v_digits
    and lower(regexp_replace(bk.name, '\s', '', 'g')) = v_name
    and bk.status <> 'cancelled'
  order by bk.created_at desc;
end $fn$;

create or replace function find_booking(p_code text, p_phone text)
returns ticket_view
language plpgsql
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
  if not _rate_hit('find:code:' || upper(trim(p_code)), 6, 600)
     or not _rate_hit('find:all', 60, 60) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  select * into v_row from bookings
  where upper(trim(code)) = upper(trim(p_code))
    and regexp_replace(phone, '\D', '', 'g') = v_digits
    and status <> 'cancelled';
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return _ticket_of(v_row);
end $fn$;

create or replace function claim_booking(p_code text, p_phone text)
returns ticket_view
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_t ticket_view;
begin
  v_t := find_booking(p_code, p_phone);
  if auth.uid() is not null then
    update bookings set user_id = auth.uid()
    where id = v_t.id and user_id is null;
  end if;
  return v_t;
end $fn$;

create or replace function claim_bookings_by_phone(p_phone text, p_name text)
returns setof ticket_view
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids uuid[];
begin
  select array_agg(t.id) into v_ids
  from find_bookings_by_phone(p_phone, p_name) t;
  if v_ids is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if auth.uid() is not null then
    update bookings set user_id = auth.uid()
    where id = any(v_ids) and user_id is null;
  end if;
  return query
  select _ticket_of(bk) from bookings bk
  where bk.id = any(v_ids) order by bk.created_at desc;
end $fn$;

revoke all on function _ticket_of(bookings) from public, anon, authenticated;
revoke all on function find_bookings_by_phone(text, text),
                       find_booking(text, text),
                       claim_booking(text, text),
                       claim_bookings_by_phone(text, text) from public;
grant execute on function find_bookings_by_phone(text, text),
                          find_booking(text, text),
                          claim_booking(text, text),
                          claim_bookings_by_phone(text, text)
  to anon, authenticated;

-- ─────────────────────────────────────────── 8. 남성 배수 범위

alter table events drop constraint if exists events_male_mult_check;
alter table events add constraint events_male_mult_check
  check (male_price_multiplier >= 0 and male_price_multiplier <= 5);

-- ─────────────────────────────────────────── 확인
--  쿠폰 없는 입장자 0 · create_booking 은 service_role 만 · 조회 함수 4개
select '입장했는데 쿠폰 없음' as 항목, count(*)::text as 값
from bookings b
where b.status = 'checked_in'
  and exists (select 1 from event_perks p where p.event_id = b.event_id)
  and not exists (select 1 from booking_perks bp where bp.booking_id = b.id)
union all
select 'create_booking anon 호출 가능', bool_or(has_function_privilege('anon', p.oid, 'execute'))::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_booking'
union all
select '조회 함수(ticket_view) 수', count(*)::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('find_booking', 'find_bookings_by_phone', 'claim_booking', 'claim_bookings_by_phone')
  and pg_get_function_result(p.oid) like '%ticket_view%';
