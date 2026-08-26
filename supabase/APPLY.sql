-- ═══════════════════════════════════════════════════════════════════
--  APPLY.sql — 아직 안 돌린 것 전부. **한 번만 붙여 넣으면 됩니다.**
--
--  들어 있는 것
--   0. **예매 금액 계산 고침 (급함)** — 화면은 69,000, 저장은 74,000
--      으로 갈리고 있습니다. 내 티켓에 다른 값이 뜨는 게 이것입니다
--   1. 크루 신청 표 (crew_applications) + 권한
--   2. 프로필 (profiles)
--   3. 후기 (reviews) + 자격 판정 can_review()
--   4. 수수료 10% — platform_stats 뷰
--
--  두 번 돌려도 안전합니다. 이미 있으면 건너뜁니다.
--
--  ⚠ 수수료는 지난 행사까지 같이 10% 로 다시 계산됩니다. 파생값을
--    저장하지 않고 매번 집계하는 구조라 그렇습니다. 정산이 끝난 행사가
--    있으면 돌리기 전에 그 금액을 적어 두세요.
--
--  연락처·게스트 정리는 GUEST_INFO.sql, 운영자 잠금은 LOCK_ADMIN.sql
--  로 따로 있습니다.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────── 0. 예매 금액 계산 (급함)
--
--  **화면과 서버가 다른 값을 쓰고 있다.**
--  차수별 남성가(male_price)를 넣을 때 앱과 tier_price() 는 고쳤는데,
--  실제로 금액을 정하는 create_booking() 은 옛 계산을 그대로 들고 있다.
--  그래서 3차 남성이 화면에서 69,000 을 보고 누르면 74,000 으로 저장된다.
--  내 티켓에 다른 값이 뜨는 게 이것이다.
--
--  차수별 남성가 컬럼과 tier_price() 도 여기서 같이 보장한다 —
--  EVENT_UPDATE.sql 을 안 돌렸어도 이 파일 하나로 맞는다.

alter table ticket_tiers add column if not exists male_price int;
do $$ begin
  alter table ticket_tiers add constraint ticket_tiers_male_price_check
    check (male_price is null or male_price >= 0);
exception when duplicate_object then null;
end $$;

create or replace function tier_price(p_tier ticket_tiers, p_event events, p_gender text)
returns int language sql immutable as $$
  select case
    when p_gender <> 'M' then p_tier.price
    when p_tier.male_price is not null then p_tier.male_price
    else (round(p_tier.price * p_event.male_price_multiplier / 1000.0) * 1000)::int
  end;
$$;

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

  -- 이 행사의 모든 예매를 여기서 직렬화한다
  select * into v_event from events where id = p_event_id for update;
  if not found or v_event.status <> 'open' then
    raise exception 'EVENT_NOT_OPEN' using errcode = 'P0001';
  end if;

  select * into v_tier
  from ticket_tiers where id = p_tier_id and event_id = p_event_id;
  if not found then
    raise exception 'TIER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 잠근 뒤 다시 센다. 클라이언트가 보낸 잔여는 이미 낡았다
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

  -- **초대를 먼저 확인한다.** 금액이 초대 여부에 달려 있기 때문이다
  v_invite := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  if v_invite is not null and not exists (
    select 1 from crew_members
    where crew_id = v_event.crew_id and invite_code = v_invite
  ) then
    v_invite := null;   -- 없는 코드는 조용히 버린다. 예매 자체를 막지 않는다
  end if;

  -- 금액도 서버가 정한다. 클라이언트가 보낸 금액은 쓰지 않는다.
  -- 유효한 초대가 있으면 게스트가, 없으면 차수 가격(남성가 포함)
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

-- 테이블 예약 (VIP · VVIP · PLUS).
--
-- 차수(ticket_tiers)와 다른 것이다. 차수는 입장권이고, 테이블은 자리를
-- 통째로 잡는 것이며 **테이블을 잡으면 입장비가 없다.** 같은 표에 섞으면
-- 정원 계산이 깨진다 — 테이블 손님은 입장권을 안 사기 때문이다.
--
-- 값은 크루가 앱에서 넣는다. 여기에 미리 적어 두지 않는다 — 파티마다
-- 다르고, 코드에 박아 두면 바꿀 때마다 배포해야 한다.

create table if not exists event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  name  text not null,               -- VIP · VVIP · PLUS
  -- 계좌이체 기준. 메뉴판이 그렇게 적혀 있다
  price int not null check (price >= 0),
  -- 카드로 결제하면 더 받는다. 비우면 안 띄운다
  card_price int check (card_price is null or card_price >= 0),
  -- 몇 명까지 앉나. 입장비가 없는 인원이 이 숫자다
  seats int not null check (seats > 0),
  note  text,                        -- 구성 (주류·안주 등)
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 테이블 전체에 공통으로 붙는 안내 (샴페인 종류·추가 가격·예약 문의 등).
-- 줄마다 반복하면 화면이 같은 말로 도배된다
alter table events add column if not exists tables_note text;

create index if not exists event_tables_event_idx
  on event_tables (event_id, sort_order);

alter table event_tables enable row level security;

-- 손님이 봐야 파는 것이다. 파티가 보이면 테이블도 보인다
drop policy if exists event_tables_read on event_tables;
create policy event_tables_read on event_tables
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status in ('open', 'closed', 'done')
        or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_tables_write on event_tables;
create policy event_tables_write on event_tables
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );

-- 파티 사진.
--
-- 커버 한 장으로는 "어떤 파티인지" 가 안 전해진다. 낮의 물, 밤의 조명,
-- DJ, 루프탑 — 다 다른 장면인데 한 장만 보고 정해야 했다.
--
-- 커버와 따로 둔다. 커버는 목록 카드에 쓰는 대표 한 장이고, 여기는
-- 상세에서만 보는 여러 장이다.

create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists event_photos_event_idx
  on event_photos (event_id, sort_order);

alter table event_photos enable row level security;

drop policy if exists event_photos_read on event_photos;
create policy event_photos_read on event_photos
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (e.status in ('open', 'closed', 'done') or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_photos_write on event_photos;
create policy event_photos_write on event_photos
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );

-- 웹 푸시 구독.
--
-- 로그인 없이 예매할 수 있는 앱이라, 푸시도 **익명 세션에 붙는다.**
-- 브라우저를 지우면 같이 날아가는데, 그건 그 브라우저가 더 이상 그
-- 사람이 아니라는 뜻이므로 맞다.
--
-- endpoint 가 사실상 키다. 같은 기기가 다시 구독하면 키가 같으므로
-- 줄이 늘지 않는다.

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id  uuid references auth.users on delete cascade,
  p256dh   text not null,
  auth     text not null,
  -- 마지막으로 보내다 실패한 시각. 죽은 구독을 지우는 근거
  failed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists push_subs_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- 본인 것만. 남의 endpoint 를 알면 그 기기로 알림을 보낼 수 있다
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 보낼 것 찾기
--
-- 크론이 30분마다 부른다. **보낼 사람만 골라 준다** — 앱이 예매를 통째로
-- 읽어 걸러 내면 그 순간 손님 명단이 서버 밖으로 나간다.
--
-- 두 가지를 본다.
--   1. 미입금이 세 시간 뒤에 풀린다  → 지금 넣으라고 알린다
--   2. 오늘 그 파티가 열린다         → 시간·장소를 알린다
--
-- 같은 걸 두 번 안 보내려고 보낸 기록을 남긴다.

create table if not exists push_log (
  booking_id uuid references bookings on delete cascade not null,
  kind text not null check (kind in ('expiring', 'today', 'paid')),
  sent_at timestamptz default now(),
  primary key (booking_id, kind)
);

create or replace function push_targets()
returns table (
  booking_id uuid,
  kind       text,
  endpoint   text,
  p256dh     text,
  auth       text,
  title      text,
  body       text,
  url        text
)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
begin
  return query
  with due as (
    select b.id as bid,
           case
             when b.status = 'pending' then 'expiring'
             else 'today'
           end as k,
           b.user_id as uid,
           b.code as code,
           e.title as ev_title,
           e.slug as ev_slug,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') as at_time,
           e.venue_name as venue
    from bookings b
    join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status <> 'cancelled'
      and (
        -- 세 시간 안에 풀린다
        (b.status = 'pending'
         and b.expires_at > now()
         and b.expires_at < now() + interval '3 hours')
        or
        -- 오늘 열린다
        (e.starts_at::date = (now() at time zone 'Asia/Seoul')::date
         and e.starts_at > now())
      )
  )
  select d.bid, d.k, s.endpoint, s.p256dh, s.auth,
    case when d.k = 'expiring' then '자리가 곧 풀려요'
         else '오늘이에요' end,
    case when d.k = 'expiring'
      then d.ev_title || ' · ' || d.code || ' 입금이 아직이에요. 세 시간 뒤 자동 취소됩니다.'
      else d.ev_title || ' · ' || d.at_time || ' ' || d.venue || ' 에서 봬요.'
    end,
    '/tickets'
  from due d
  join push_subscriptions s on s.user_id = d.uid and s.failed_at is null
  where not exists (
    select 1 from push_log l where l.booking_id = d.bid and l.kind = d.k
  );
end $fn$;

revoke all on function push_targets from public, anon, authenticated;

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

-- 익명 계정을 진짜 계정으로 승격한다.
--
-- **이게 "구글 로그인은 됐는데 로그아웃 상태" 의 원인이다.**
--
-- 이 앱은 첫 방문에 익명 세션을 만든다(로그인 없이 예매하려고). 그
-- 상태에서 구글 로그인을 누르면 signInWithOAuth 가 아니라 linkIdentity
-- 로 간다 — 익명으로 잡아 둔 예매를 잃지 않으려고 그렇게 짰다.
--
-- 그런데 linkIdentity 는 구글 신원을 **붙이기만 하고** auth.users 의
-- is_anonymous 를 그대로 둔다. 앱은 `user && !user.is_anonymous` 로
-- 로그인 여부를 보므로, 구글 창까지 다 돌고 와도 여전히 로그아웃이다.
--
-- 그래서 콜백에서 이 함수를 부른다. **신원이 실제로 붙어 있을 때만**
-- 표시를 내린다 — 아무나 부른다고 익명이 풀리면 안 된다.

create or replace function promote_anonymous()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_id  uuid := auth.uid();
  v_has boolean;
begin
  if v_id is null then
    return false;
  end if;

  -- 익명이 아닌 신원(구글·카카오·애플·이메일)이 붙어 있는가
  select exists (
    select 1 from auth.identities i
    where i.user_id = v_id and i.provider <> 'anonymous'
  ) into v_has;

  if not v_has then
    return false;
  end if;

  update auth.users
  set is_anonymous = false, updated_at = now()
  where id = v_id and is_anonymous;

  return found;
end $fn$;

revoke all on function promote_anonymous from public, anon;
grant execute on function promote_anonymous to authenticated;

-- ───────────────────────────────────────── 1. 크루 신청

-- 크루 신청.
--
-- 지금은 "크루로 전환하기" 를 누르면 크루 로그인으로 보낸다. 크루로
-- 등록된 사람만 들어가는 문이라, 등록이 안 된 사람은 그냥 막힌다.
-- 등록 요청을 받을 자리가 없어서 인스타 DM 으로 오라고 적어 뒀는데,
-- 그러면 무엇을 물어봐야 하는지도 매번 다시 정해야 한다.
--
-- 받을 것을 표로 못 박는다. 승인하면 그대로 크루가 된다.

create table if not exists crew_applications (
  id uuid primary key default gen_random_uuid(),

  -- 크루
  crew_name  text not null,
  slug       text not null,
  instagram  text,
  bio        text,

  -- 연락 — 승인 여부를 알려야 하고, 사고가 나면 여기로 건다
  contact_name  text not null,
  contact_phone text not null,
  email         text not null,

  -- 심사에 실제로 쓰는 것. 없으면 승인 기준이 사람 기분이 된다
  venue      text,   -- 주로 어디서 여는가
  scale      text,   -- 보통 몇 명 규모인가
  history    text,   -- 지금까지 연 파티
  note       text,

  user_id uuid references auth.users on delete set null,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_at   timestamptz,
  -- 승인해서 만들어진 크루. 신청과 크루를 이어 둬야 나중에 추적된다
  crew_id uuid references crews on delete set null,

  created_at timestamptz default now()
);

create index if not exists crew_applications_status_idx
  on crew_applications (status, created_at desc);

alter table crew_applications enable row level security;

-- 본인 신청만 본다. 남의 신청서에는 연락처가 들어 있다
drop policy if exists crew_apps_own_read on crew_applications;
create policy crew_apps_own_read on crew_applications
  for select using (user_id = auth.uid() or is_app_admin());

-- **로그인한 사람만 낸다.** 익명 세션으로 받으면 승인해도 그 계정에
-- 권한을 이어 줄 수가 없고, 장난 신청을 막을 방법도 없다
drop policy if exists crew_apps_insert on crew_applications;
create policy crew_apps_insert on crew_applications
  for insert with check (
    user_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- 심사는 운영자만
drop policy if exists crew_apps_admin_write on crew_applications;
create policy crew_apps_admin_write on crew_applications
  for update using (is_app_admin()) with check (is_app_admin());

-- ───────────────────────────────────────── 2. 프로필 · 3. 후기

-- 프로필과 후기.
--
-- ── 프로필
-- 지금 마이 화면은 이메일 주소를 그대로 띄운다. 남한테 보여 줄 이름이
-- 없어서 커뮤니티에 글을 쓸 때마다 닉네임을 다시 친다.
--
-- **이름과 연락처를 같이 둔다.** 예매할 때마다 같은 값을 또 적는 게
-- 제일 귀찮은 일이고, 오타가 나면 입금자명이 안 맞아 대조가 깨진다.
--
-- ── 후기
-- 예매한 사람만 쓴다. 안 온 사람이 쓰는 후기는 다음 파티를 고르는 데
-- 도움이 안 되고, 경쟁 크루가 깎는 통로가 된다.
--
-- **파티가 시작한 뒤에만 쓴다.** 열리지도 않은 파티의 후기는 그냥 홍보다.

create table if not exists profiles (
  user_id  uuid primary key references auth.users on delete cascade,
  nickname text,
  -- 예매 폼에 미리 채운다. 실명과 연락처는 입금 대조·현장 확인에 쓰인다
  real_name text,
  phone     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

-- **본인 것만.** 닉네임은 글에 이미 박혀 나가므로 표를 열 이유가 없다
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 취향
--
-- 처음 들어온 사람에게 무엇을 먼저 보여 줄지 정할 근거가 없었다.
-- 지역과 카테고리만 받는다 — 더 물으면 시작 화면이 길어지고, 길면
-- 건너뛴다. 비어 있으면 예전처럼 전체를 보여 준다.
alter table profiles add column if not exists areas      text[] not null default '{}';
alter table profiles add column if not exists categories text[] not null default '{}';
-- 시작 화면을 봤는지. 취향을 안 골라도 다시 안 띄운다
alter table profiles add column if not exists onboarded_at timestamptz;

-- ─────────────────────────────────────────── 취향 집계
--
-- 운영자가 "사람들이 뭘 좋아하는가" 를 봐야 다음에 뭘 밀지 정한다.
--
-- **그런데 프로필은 본인만 볼 수 있다**(profiles_own). 운영자에게 표를
-- 통째로 열면 이름·연락처까지 같이 열린다. 필요한 건 합계뿐이므로
-- 합계만 내주는 함수를 둔다 — 누가 뭘 골랐는지는 여기서도 안 나온다.
create or replace function preference_stats()
returns table (kind text, value text, people int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
    select '지역'::text, a::text, count(*)::int
    from profiles p, unnest(p.areas) a
    group by a
    union all
    select '분위기'::text, c::text, count(*)::int
    from profiles p, unnest(p.categories) c
    group by c
    order by 1, 3 desc;
end $fn$;

revoke all on function preference_stats from public, anon;
grant execute on function preference_stats to authenticated;

-- 몇 명이 시작 화면을 봤고 몇 명이 실제로 골랐나
create or replace function preference_summary()
returns table (people int, onboarded int, picked int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
    select count(*)::int,
           count(*) filter (where onboarded_at is not null)::int,
           count(*) filter (
             where cardinality(areas) > 0 or cardinality(categories) > 0
           )::int
    from profiles;
end $fn$;

revoke all on function preference_summary from public, anon;
grant execute on function preference_summary to authenticated;

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  user_id  uuid references auth.users on delete cascade not null,
  rating   int not null check (rating between 1 and 5),
  body     text not null,
  nickname text not null,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  -- 한 사람이 한 파티에 하나. 여러 개면 평점이 무너진다
  unique (event_id, user_id)
);

create index if not exists reviews_event_idx
  on reviews (event_id, created_at desc);

alter table reviews enable row level security;

/**
 * 이 사람이 그 파티 후기를 쓸 자격이 있나.
 *
 * 취소가 아닌 예매가 본인 계정에 붙어 있어야 하고, 파티가 시작한 뒤여야
 * 한다. 익명 세션으로 예매했다가 나중에 로그인한 경우는 예매가 옛
 * user_id 에 남아 안 잡힌다 — 그건 티켓 찾기로 이어 붙인 뒤에 쓴다.
 */
create or replace function can_review(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
    from bookings b
    join events e on e.id = b.event_id
    where b.event_id = p_event
      and b.user_id = auth.uid()
      and b.status <> 'cancelled'
      and e.starts_at <= now()
  );
$fn$;

-- 후기는 누구나 읽는다. 파티를 고르는 근거라 로그인 전에도 보여야 한다
drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews
  for select using (deleted_at is null or is_app_admin());

drop policy if exists reviews_write on reviews;
create policy reviews_write on reviews
  for insert with check (user_id = auth.uid() and can_review(event_id));

drop policy if exists reviews_own_edit on reviews;
create policy reviews_own_edit on reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 운영자는 가린다. 지우지는 않는다 — 무엇을 가렸는지 남아야 한다
drop policy if exists reviews_admin on reviews;
create policy reviews_admin on reviews
  for all using (is_app_admin()) with check (is_app_admin());

-- 파티 카드에 별점을 띄우려면 매번 세는 것보다 뷰가 낫다
drop view if exists review_stats cascade;
create view review_stats as
select
  event_id,
  count(*)::int as reviews,
  round(avg(rating)::numeric, 1) as rating
from reviews
where deleted_at is null
group by event_id;

grant select on review_stats to anon, authenticated;

-- 가입자 목록 (운영자 전용).
--
-- `auth.users` 는 앱에서 직접 못 읽는다. 프로필도 본인만 볼 수 있게
-- 막혀 있다(profiles_own). 그래서 운영 화면에 가입자가 아예 안 보였다.
--
-- **security definer 로 감싸되 함수 안에서 운영자인지 다시 확인한다.**
-- grant 만으로는 로그인한 아무나 전체 가입자와 연락처를 긁어 갈 수 있다.
--
-- 비밀번호 해시·토큰 같은 건 절대 내보내지 않는다. 화면에서 쓰는 값만.

create or replace function member_list(p_q text default null)
returns table (
  user_id      uuid,
  email        text,
  provider     text,
  is_anonymous boolean,
  joined_at    timestamptz,
  last_seen_at timestamptz,
  nickname     text,
  real_name    text,
  phone        text,
  areas        text[],
  categories   text[],
  bookings     int,
  paid         bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- **모든 컬럼에 별칭을 붙인다.** 반환 컬럼 이름(user_id, email, paid …)이
  -- 표의 컬럼 이름과 같아서, 안 붙이면 PL/pgSQL 이 어느 쪽인지 모른다고
  -- 터진다 — "column reference user_id is ambiguous".
  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_app_meta_data ->> 'provider', '알 수 없음'),
    coalesce(u.is_anonymous, false),
    u.created_at,
    u.last_sign_in_at,
    p.nickname,
    p.real_name,
    p.phone,
    coalesce(p.areas, '{}'::text[]),
    coalesce(p.categories, '{}'::text[]),
    coalesce(b.n_bookings, 0)::int,
    coalesce(b.sum_paid, 0)::bigint
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join (
    select bk.user_id as uid,
           count(*) filter (where bk.status <> 'cancelled') as n_bookings,
           sum(bk.amount) filter (where bk.status in ('paid', 'checked_in')) as sum_paid
    from bookings bk
    where bk.user_id is not null
    group by bk.user_id
  ) b on b.uid = u.id
  where v_q is null
     or u.email ilike '%' || v_q || '%'
     or p.nickname ilike '%' || v_q || '%'
     or p.real_name ilike '%' || v_q || '%'
     or p.phone like '%' || v_q || '%'
  order by u.created_at desc
  limit 500;
end $fn$;

revoke all on function member_list from public, anon;
grant execute on function member_list to authenticated;

-- 머리에 띄울 숫자
create or replace function member_summary()
returns table (
  people    int,
  anonymous int,
  google    int,
  with_profile int,
  buyers    int
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
#variable_conflict use_column
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select
    count(*) filter (where not coalesce(u.is_anonymous, false))::int,
    count(*) filter (where coalesce(u.is_anonymous, false))::int,
    count(*) filter (where u.raw_app_meta_data ->> 'provider' = 'google')::int,
    (select count(*) from profiles pr)::int,
    (select count(distinct bk.user_id) from bookings bk
     where bk.user_id is not null and bk.status <> 'cancelled')::int
  from auth.users u;
end $fn$;

revoke all on function member_summary from public, anon;
grant execute on function member_summary to authenticated;

-- ───────────────────────────────────────── 4. 수수료 10%

-- 플랫폼 수수료 10% 로.
--
-- 앱의 lib/rules.ts 는 코드로 배포되지만, platform_stats 뷰는 DB 안에
-- 숫자를 따로 들고 있다. 운영 화면이 그 뷰에서 읽으므로 여기까지 고쳐야
-- 청구한 값과 우리가 보는 값이 같아진다.
--
-- 이미 지난 행사의 수수료도 같이 10% 로 다시 계산된다. 파생값을 저장하지
-- 않고 매번 집계하는 구조라 그렇다 — 정산이 끝난 행사가 있으면 이 파일을
-- 돌리기 전에 그 금액을 따로 적어 두세요.

create or replace view platform_stats
with (security_invoker = on)
as
select
  e.id as event_id,
  e.crew_id,
  e.title,
  e.starts_at,
  e.status,
  c.name as crew_name,
  e.capacity,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'), 0)::int as booked,
  coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0)::bigint as revenue_paid,
  round(
    -- lib/rules.ts 의 FEE_RATE 와 같아야 한다
    coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0) * 0.10
  )::bigint as fee
from events e
join crews c on c.id = e.crew_id
left join bookings b on b.event_id = e.id
group by e.id, c.name;

revoke all on platform_stats from anon;
grant select on platform_stats to authenticated;

-- ───────────────────────────────────────── 우리 크루

-- 공식 인스타그램. 파티 상세의 '주최' 옆에 링크로 붙고,
-- 운영 화면 크루 목록에서도 바로 열린다
update crews set instagram = 'blackoutcrew_official' where slug = 'blackout';

-- AFTER SUNSET 커버. 릴스 원본(P1023231)에서 풀장 장면을 한 프레임 뽑아
-- 5:3 으로 자르고 색을 올렸다. 원본이 로그에 가까워 평평해서, 그대로
-- 쓰면 카드가 뿌옇게 보인다. 파일은 우리 서버에 있다
update events set cover_url = '/covers/after-sunset.jpg'
where slug = 'after-sunset-20260829';

-- 게스트가. DJ·크루 초대 코드를 넣으면 이 금액이 된다.
-- 지금까지 크루가 손으로 고치던 걸 앱이 한다 (명세서 기준 30,000원)
update events set guest_price = 30000
where slug = 'after-sunset-20260829';

-- ── DJ 마다 초대 코드가 하나씩 있어야 한다.
--
-- **라인업에 올린 DJ 가 멤버로 안 들어가 있으면 코드가 없다.** 코드가
-- 없으면 그 DJ 가 데려온 손님이 (직접) 으로 잡히고, 정산할 때 누구
-- 몫인지 알 수 없다.
--
-- 라인업에서 이름을 가져와 없는 것만 만든다. 백투백(HEIDY × CHIPS)은
-- 한 사람이 아니라 두 사람이므로 건너뛴다 — 각자 코드를 이미 갖는다.
do $inv$
declare v_event uuid; v_crew uuid; r record; n int := 0;
begin
  select id, crew_id into v_event, v_crew
  from events where slug = 'after-sunset-20260829';
  if v_event is null then return; end if;

  for r in
    select distinct upper(trim(l.artist_name)) as nm
    from lineups l
    where l.event_id = v_event
      and l.artist_name !~ '[×x]'          -- 백투백 줄은 건너뛴다
  loop
    -- 코드는 이름 그대로. DJ 가 외워서 불러 줄 수 있어야 한다
    insert into crew_members (crew_id, user_id, display_name, invite_code, role)
    values (v_crew, null, r.nm, regexp_replace(r.nm, '[^A-Z0-9]', '', 'g'), 'member')
    on conflict (crew_id, invite_code) do nothing;
    n := n + 1;
  end loop;
  raise notice '라인업 %명 확인', n;
end $inv$;

-- AFTER SUNSET TABLE. 메뉴판(2026.08.13)에 적힌 값 그대로다.
-- 가격은 계좌이체 기준이고 카드는 따로 적는다
do $tb$
declare v_event uuid;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then return; end if;

  delete from event_tables where event_id = v_event;
  insert into event_tables (event_id, name, price, card_price, seats, note, sort_order)
  values
    (v_event, 'VIP',        300000,  350000, 4,
     '샴페인 1병 · 음료수 3 · 생수 4', 0),
    (v_event, 'VIP PLUS',   500000,  550000, 4,
     '샴페인 2병 · 음료수 4 · 생수 4', 1),
    (v_event, 'VVIP',      1500000, 1650000, 8,
     '샴페인 5병 · 음료수 6 · 생수 8 · 전광판 · 폭죽', 2),
    (v_event, 'VVIP PLUS', 2500000, 2750000, 8,
     '샴페인 9병 · 음료수 8 · 생수 8 · 전광판 · 폭죽', 3);

  update events set tables_note = concat_ws(E'
',
    '테이블 인원 전원 입장료 면제 · 방수 손목밴드 · 락커 포함',
    'VVIP 이상 전광판 메시지 · 폭죽 서빙 · 스냅 우선 촬영',
    '샴페인은 DEEP LUMINOUS 750ml',
    '음료수 · 생수는 표기 수량만 제공 · 추가분은 바 메뉴 가격',
    '샴페인 추가 1병 280,000원 (계좌이체 250,000원)',
    '표시 가격은 계좌이체 기준'
  ) where id = v_event;
end $tb$;

-- 파티 사진. 릴스 원본에서 장면이 겹치지 않게 다섯 장을 뽑았다
do $ph$
declare v_event uuid;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then return; end if;

  delete from event_photos where event_id = v_event;
  insert into event_photos (event_id, url, caption, sort_order) values
    (v_event, '/photos/after-sunset/1.jpg', '루프탑에서 본 서울', 0),
    (v_event, '/photos/after-sunset/2.jpg', '물에 사람 가득',     1),
    (v_event, '/photos/after-sunset/3.jpg', 'DJ 부스',            2),
    (v_event, '/photos/after-sunset/4.jpg', '튜브 · 물놀이',      3),
    (v_event, '/photos/after-sunset/5.jpg', '바',                 4);
end $ph$;

-- ───────────────────────────────────────── 확인

-- **금액이 어긋난 예매.** 앞으로 들어올 예매는 위에서 고쳤지만, 이미
-- 저장된 건은 그대로다. 자동으로 안 고친다 — GUEST_INFO.sql 로 실제
-- 입금액을 넣어 둔 건들이 차수 가격으로 되돌아가면 매출이 다시 틀어진다.
-- 여기 뜨는 건만 보고 정하세요.
select '금액이 어긋난 예매' as 구분,
       b.code as 예매번호, b.name as 이름, b.gender as 성별,
       t.name as 차수, b.amount as 저장된금액,
       tier_price(t, e, b.gender, b.invite_code is not null) * b.quantity as 계산된금액,
       b.created_at as 신청
from bookings b
join ticket_tiers t on t.id = b.tier_id
join events e on e.id = b.event_id
where b.status <> 'cancelled'
  and b.amount <> tier_price(t, e, b.gender, b.invite_code is not null) * b.quantity
order by b.created_at desc;



select '표가 생겼나' as 구분,
  to_regclass('public.crew_applications') is not null as 크루신청,
  to_regclass('public.profiles') is not null as 프로필,
  to_regclass('public.reviews') is not null as 후기;

select 'DJ 별 초대 코드' as 구분;
select m.display_name as 이름, m.invite_code as 코드,
       count(b.id) filter (where b.status <> 'cancelled') as 초대인원,
       coalesce(sum(b.amount) filter (where b.status in ('paid','checked_in')), 0) as 금액
from crew_members m
left join bookings b on b.invite_code = m.invite_code
  and b.event_id = (select id from events where slug = 'after-sunset-20260829')
where m.crew_id = (select crew_id from events where slug = 'after-sunset-20260829')
group by m.display_name, m.invite_code
order by 3 desc, 1;

select '수수료' as 구분, title as 파티, revenue_paid as 확정매출, fee as 수수료
from platform_stats order by starts_at desc;
