-- ═══════════════════════════════════════════════════════════════════
--  개인정보 쪽 구멍 네 개를 막는다
--
--  1. 예매 조회·예매 생성·초대코드 확인·글쓰기를 DB 안에서 제한한다
--  2. rate_ok 를 손님이 못 부르게 한다
--  3. event_stats 에서 매출을 뺀다. 매출은 스태프만 보는 뷰로
--  4. post_list 에서 user_id 를 뺀다
--
--  두 번 돌려도 안전하다.
-- ═══════════════════════════════════════════════════════════════════
--
--  ## 왜 라우트 제한으로는 안 되나
--
--  앱은 /api/bookings/find 에서 IP 당 분당 5번으로 막는다. 그런데 그
--  라우트가 부르는 RPC(claim_bookings_by_phone 등)는 anon 에게 열려
--  있고, anon 키는 브라우저에 그대로 들어 있는 공개 키다. 라우트를
--  거치지 않고 PostgREST 에 직접 부르면 제한이 없다.
--
--      curl .../rest/v1/rpc/claim_bookings_by_phone -H "apikey: <anon>"
--
--  번호 하나에 흔한 이름을 수천 개 돌리면 그 사람이 어느 파티에 몇 명
--  예매했는지 나온다. 예매 생성도 마찬가지 — 번호를 바꿔 가며 부르면
--  정원 30 을 통째로 잠글 수 있다. 막는 자리는 함수 안이어야 한다.
--
--  ## rate_ok 가 왜 문제였나
--
--  anon 이 부를 수 있었다. 버킷 이름을 마음대로 넣을 수 있으니 남의
--  버킷을 미리 채워서 그 사람을 잠글 수 있고, rate_hits 에 쓰레기를
--  무한히 넣을 수 있다. 서버(service_role) 와 definer 함수만 쓴다.

-- ─────────────────────────────────────────── 1. 제한 장치를 안으로

-- 함수 안에서만 쓴다. 아무에게도 안 준다
create or replace function _rate_hit(p_bucket text, p_limit int, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_win timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_seconds) * p_seconds);
  v_hits int;
begin
  insert into rate_hits (bucket, window_at, hits)
  values (p_bucket, v_win, 1)
  on conflict (bucket, window_at)
  do update set hits = rate_hits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then
    delete from rate_hits where window_at < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end $fn$;
revoke all on function _rate_hit from public, anon, authenticated;

-- 손님은 못 부른다. 서버 라우트는 service_role 로 부른다 (lib/ratelimit.ts)
revoke all on function rate_ok from public, anon, authenticated;
grant execute on function rate_ok to service_role;

-- 누가 부르는지. 로그인이면 uid, 아니면 'anon'. IP 는 DB 에 안 온다
create or replace function _who()
returns text
language sql
stable
as $$ select coalesce(auth.uid()::text, 'anon') $$;

-- ─────────────────────────────────────────── 2. 예매 조회

-- 번호 하나에 10분에 6번. 본인이 이름을 두세 번 틀리는 건 통과하고
-- 이름을 돌리는 건 막힌다. 전체로도 분당 60 — 번호를 돌리는 쪽을 막는다
create or replace function find_bookings_by_phone(p_phone text, p_name text)
returns setof bookings
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
  select bk.*
  from bookings bk
  where regexp_replace(bk.phone, '\D', '', 'g') = v_digits
    and lower(regexp_replace(bk.name, '\s', '', 'g')) = v_name
    and bk.status <> 'cancelled'
  order by bk.created_at desc;
end $fn$;

create or replace function find_booking(p_code text, p_phone text)
returns bookings
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
  -- 예매번호가 PM0001 부터 순서라 번호를 돌리며 전화번호를 맞춰 볼 수 있다
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
  return v_row;
end $fn$;

-- claim_* 는 위 둘을 부르니 같이 막힌다. 다시 정의할 것 없다.

-- ─────────────────────────────────────────── 3. 초대 코드

-- 코드가 BHO · LYNN 처럼 짧다. 파티 하나에 분당 20번이면 사람은 안 걸린다
create or replace function check_invite(p_event uuid, p_code text)
returns table (valid boolean, price int)
language plpgsql
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
    if not _rate_hit('invite:' || p_event::text, 20, 60) then
      raise exception 'RATE' using errcode = 'P0001';
    end if;
    select exists (
      select 1 from crew_members m
      where m.crew_id = v_event.crew_id and m.invite_code = v_code
    ) into v_ok;
  end if;
  return query select v_ok, case when v_ok then v_event.guest_price else null end;
end $fn$;

-- ─────────────────────────────────────────── 4. 예매 생성 · 글쓰기
--
--  함수를 다시 쓰지 않고 **insert 직전에 잡는다.** 어느 길로 들어와도
--  표에 쓰는 순간은 하나다.
--
--  예매  같은 번호로 시간당 3건, 전체로 10분에 60건.
--        create_booking 은 같은 번호 중복을 이미 막지만, 다른 파티나
--        취소 뒤 재예매까지 세면 3건이면 넉넉하다.
--  글    한 사람이 10분에 5개, 댓글은 10개. 전체로 분당 30.

create or replace function _bookings_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_digits text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  -- 크루가 손으로 넣는 건(스태프·관리자) 안 센다
  if is_event_staff(new.event_id) or is_app_admin() then
    return new;
  end if;
  if not _rate_hit('book:phone:' || v_digits, 3, 3600)
     or not _rate_hit('book:all', 60, 600) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists bookings_rate on bookings;
create trigger bookings_rate
  before insert on bookings
  for each row execute function _bookings_rate();

create or replace function _posts_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if is_app_admin() then
    return new;
  end if;
  if not _rate_hit('post:' || _who(), 5, 600)
     or not _rate_hit('post:all', 30, 60) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

create or replace function _comments_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if is_app_admin() then
    return new;
  end if;
  if not _rate_hit('comment:' || _who(), 10, 600)
     or not _rate_hit('comment:all', 30, 60) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists posts_rate on posts;
create trigger posts_rate before insert on posts
  for each row execute function _posts_rate();
drop trigger if exists comments_rate on post_comments;
create trigger comments_rate before insert on post_comments
  for each row execute function _comments_rate();

-- ─────────────────────────────────────────── 5. 매출은 스태프만
--
--  event_stats 가 anon 에게 열려 있었고 거기에 revenue_paid ·
--  revenue_total 이 있었다. 파티마다 얼마 벌었는지 누구나 읽었다.
--  잔여·성비는 손님이 봐야 하는 값이니 남기고 돈만 뺀다.

drop view if exists event_stats cascade;
create view event_stats as
select
  e.id as event_id,
  e.capacity,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled'), 0)::int as booked,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled' and b.gender = 'F'), 0)::int as booked_f,
  coalesce(sum(b.quantity) filter (where b.status <> 'cancelled' and b.gender = 'M'), 0)::int as booked_m
from events e
left join bookings b on b.event_id = e.id
group by e.id;
grant select on event_stats to anon, authenticated;

-- 호출한 사람 권한으로 돈다(security_invoker). bookings RLS 가 그대로
-- 걸려서 스태프는 자기 파티 예매를, 손님은 자기 것만 더한다 —
-- 손님이 부르면 자기 예매 금액만 나온다. 크루 화면이 이걸 읽는다
drop view if exists event_money;
create view event_money
with (security_invoker = on)
as
select
  e.id as event_id,
  coalesce(sum(b.amount) filter (where b.status in ('paid', 'checked_in')), 0)::bigint as revenue_paid,
  coalesce(sum(b.amount) filter (where b.status <> 'cancelled'), 0)::bigint as revenue_total
from events e
left join bookings b on b.event_id = e.id
group by e.id;
revoke all on event_money from anon;
grant select on event_money to authenticated;

-- ─────────────────────────────────────────── 6. 글 목록에서 user_id 를 뺀다
--
--  화면은 "내 글인가" 만 알면 된다. 남의 uid 를 내보낼 이유가 없다.

drop view if exists post_list cascade;
create view post_list as
select
  p.id, p.nickname, p.body, p.event_id, p.created_at,
  (p.user_id is not null and p.user_id = auth.uid()) as mine,
  (p.user_id is null) as anon,
  coalesce(c.n, 0)::int as comment_count,
  e.title as event_title,
  e.slug as event_slug
from posts p
left join events e on e.id = p.event_id
left join (
  select post_id, count(*) as n from post_comments
  where deleted_at is null group by post_id
) c on c.post_id = p.id
where p.deleted_at is null;
grant select on post_list to anon, authenticated;

-- ─────────────────────────────────────────── 확인

select proname as "함수",
       pg_get_function_identity_arguments(p.oid) as "인자",
       (select string_agg(grantee, ',') from information_schema.routine_privileges r
        where r.specific_name = p.proname || '_' || p.oid::text) as "권한"
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('rate_ok', '_rate_hit', 'find_booking', 'find_bookings_by_phone', 'check_invite')
order by proname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('event_stats', 'event_money', 'post_list')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee;
