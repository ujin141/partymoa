-- 쿠폰(웰컴 드링크 같은 것). Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 왜 예매랑 따로 두나
--
-- 입장권은 **한 번 쓰고 끝나는 것**이고 쿠폰은 **여러 번 나눠 쓰는 것**이다.
-- 4명이 예매하면 입장은 한 건인데 드링크는 넉 잔이다. 같은 줄에 못 담는다.
--
-- ## 왜 장수를 세지 않고 한 줄에 담나
--
-- 4명이면 쿠폰 카드가 넉 장 뜨는 게 아니라 한 장에 "4잔 중 1잔 씀" 이
-- 적힌다. 바에서 한 명이 폰을 들고 서 있고 넉 잔을 받는다 — 그게 실제
-- 모습이다. 카드 넉 장을 넘겨 가며 누르게 하면 현장이 막힌다.

-- ─────────────────────────────────────────── 혜택 정의 (호스트가 적는다)

create table if not exists event_perks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text not null,
  note text,
  -- 1인당 몇 장인지. per_person 이 false 면 예매 한 건에 이 수량만
  qty int not null default 1 check (qty between 1 and 20),
  per_person boolean not null default true,
  -- 테이블 잡은 손님만 주는 것(샴페인 같은). 기본은 전원
  table_only boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists event_perks_event_idx on event_perks (event_id);

-- ─────────────────────────────────────────── 발급된 쿠폰

create table if not exists booking_perks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  perk_id uuid not null references event_perks (id) on delete cascade,
  total int not null check (total > 0),
  used int not null default 0 check (used >= 0),
  first_used_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, perk_id),
  check (used <= total)
);

create index if not exists booking_perks_booking_idx on booking_perks (booking_id);

-- ─────────────────────────────────────────── 발급
--
-- **입금이 확인되면 자동으로 나간다.** 크루가 따로 누를 게 없다 —
-- 누를 게 하나 늘면 현장에서 반드시 빠뜨린다.

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
  if not found or v_b.status <> 'paid' then
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
    -- 인원이 고쳐지면 장수도 따라간다. 단 이미 쓴 것보다 아래로는 안 내린다
    set total = greatest(excluded.total, booking_perks.used);
end $fn$;

revoke all on function issue_perks from public;

create or replace function bookings_perks_sync() returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.status = 'paid' then
    perform issue_perks(new.id);
  else
    -- 입금을 되돌리면 안 쓴 쿠폰은 회수한다. **쓴 것은 안 지운다** —
    -- 이미 마신 잔을 없던 일로 만들면 바와 정산이 안 맞는다
    delete from booking_perks where booking_id = new.id and used = 0;
  end if;
  return new;
end $fn$;

drop trigger if exists bookings_perks on bookings;
create trigger bookings_perks
  after insert or update of status, quantity, table_id on bookings
  for each row execute function bookings_perks_sync();

-- ─────────────────────────────────────────── 사용
--
-- 손님이 직원 앞에서 누른다. 크루 화면에서도 누를 수 있다.
-- 되돌리기는 크루만 — 손님이 되돌릴 수 있으면 쿠폰이 아니다.

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

  if v_row.used >= v_row.total then
    raise exception '이미 다 쓴 쿠폰이에요.';
  end if;

  -- 파티 날에만 열린다. 넉넉하게 잡는다 — 현장에서 안 열리는 게 제일 나쁘다.
  -- 크루는 시간에 안 막힌다(늦게 온 손님을 손으로 처리해야 한다)
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

revoke all on function use_perk from public;
grant execute on function use_perk to authenticated;

/** 잘못 눌렀을 때. **크루만** 되돌린다 */
create or replace function unuse_perk(p_id uuid)
returns booking_perks
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row booking_perks;
  v_e   events;
begin
  select * into v_row from booking_perks where id = p_id for update;
  if not found then
    raise exception '쿠폰을 찾을 수 없어요.';
  end if;

  select e.* into v_e from events e
  join bookings b on b.event_id = e.id
  where b.id = v_row.booking_id;

  if not is_crew_staff(v_e.crew_id) then
    raise exception '크루만 되돌릴 수 있어요.';
  end if;
  if v_row.used = 0 then
    raise exception '아직 안 쓴 쿠폰이에요.';
  end if;

  update booking_perks
  set used = used - 1,
      last_used_at = case when used - 1 = 0 then null else last_used_at end,
      first_used_at = case when used - 1 = 0 then null else first_used_at end
  where id = p_id
  returning * into v_row;

  return v_row;
end $fn$;

revoke all on function unuse_perk from public;
grant execute on function unuse_perk to authenticated;

-- ─────────────────────────────────────────── 정책

alter table event_perks enable row level security;
alter table booking_perks enable row level security;

drop policy if exists event_perks_read on event_perks;
create policy event_perks_read on event_perks
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (e.status <> 'draft' or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_perks_write on event_perks;
create policy event_perks_write on event_perks
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );

-- 발급된 쿠폰은 **본인과 그 파티 크루만** 본다. 쓰는 건 함수로만 한다 --
drop policy if exists booking_perks_read on booking_perks;
create policy booking_perks_read on booking_perks
  for select using (
    exists (
      select 1 from bookings b
      join events e on e.id = b.event_id
      where b.id = booking_id
        and (b.user_id = auth.uid() or is_crew_staff(e.crew_id))
    )
  );

-- ─────────────────────────────────────────── 이미 입금된 건에 채운다

do $back$
declare r record;
begin
  for r in select id from bookings where status = 'paid' loop
    perform issue_perks(r.id);
  end loop;
end $back$;

-- ─────────────────────────────────────────── 확인
select count(*) as 혜택정의 from event_perks;
select count(*) as 발급된쿠폰 from booking_perks;
