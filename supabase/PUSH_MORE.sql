-- 알림 두 가지를 더한다. Supabase SQL 편집기에 붙여 넣고 실행.
--
--   review   손님에게 — 다녀온 다음 날 저녁, 후기 한 줄
--   fav      손님에게 — 찜해 둔 파티가 얼마 안 남았다
--
-- **PUSH_BEFORE.sql 을 먼저 돌린 뒤에 이걸 돌린다.**
-- **두 번 돌려도 안전하다.**
--
-- ## 왜 찜 알림은 표를 따로 쓰나
--
-- push_log 의 기본키가 (booking_id, kind) 다. 찜은 **예매가 없다** —
-- 아직 살까 말까 하는 사람이라 booking_id 를 만들 수가 없다.
--
-- push_log 를 고쳐서 booking_id 를 null 로 열면, 지금 잘 돌고 있는
-- 다섯 종류의 중복 방지가 같이 흔들린다. 새 표를 하나 두는 쪽이 싸다.

-- ─────────────────────────────────────────── 1. 로그가 새 종류를 받게
alter table push_log drop constraint if exists push_log_kind_check;
alter table push_log add constraint push_log_kind_check
  check (kind in (
    'guide', 'expiring', 'tomorrow', 'today', 'paid', 'review',
    'host', 'gender'
  ));


-- ─────────────────────────────────────────── 2. 후기 요청
--
-- 다녀온 다음 날 저녁에 한 번. **입장 처리된 사람에게만 보낸다** —
-- 예매만 하고 안 온 사람에게 후기를 묻는 건 이상하다.
--
-- 이미 쓴 사람에게도 안 보낸다.
--
-- push_targets 는 PUSH_BEFORE.sql 의 것을 그대로 두고 갈래만 하나 더
-- 얹는다. 반환 칸이 안 바뀌어서 create or replace 로 덮인다.

create or replace function push_targets()
returns table (
  booking_id uuid, kind text, endpoint text, p256dh text, auth text,
  platform text, title text, body text, url text
)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'));
begin
  return query
  with due as (
    select b.id as bid, 'expiring'::text as k, b.user_id as uid,
           b.code, e.title as ev_title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') as at_time,
           e.venue_name as venue, e.address as addr,
           e.bank_account as bank, b.amount as amount
    from bookings b join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status = 'pending'
      and b.expires_at > now()
      and b.expires_at < now() + interval '3 hours'

    union all

    select b.id, 'today', b.user_id, b.code, e.title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI'),
           e.venue_name, e.address, e.bank_account, b.amount
    from bookings b join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status <> 'cancelled'
      and (e.starts_at at time zone 'Asia/Seoul')::date
          = (now() at time zone 'Asia/Seoul')::date
      and e.starts_at > now()

    union all

    select b.id, 'tomorrow', b.user_id, b.code, e.title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI'),
           e.venue_name, e.address, e.bank_account, b.amount
    from bookings b join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status = 'paid'
      and v_hour between 19 and 21
      and (e.starts_at at time zone 'Asia/Seoul')::date
          = ((now() at time zone 'Asia/Seoul') + interval '1 day')::date

    union all

    -- 다녀온 다음 날 저녁. **입장한 사람만, 아직 안 쓴 사람만**
    select b.id, 'review', b.user_id, b.code, e.title,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI'),
           e.venue_name, e.address, e.bank_account, b.amount
    from bookings b join events e on e.id = b.event_id
    where b.user_id is not null
      and b.status = 'checked_in'
      and v_hour between 19 and 21
      and (e.ends_at at time zone 'Asia/Seoul')::date
          = ((now() at time zone 'Asia/Seoul') - interval '1 day')::date
      and not exists (
        select 1 from reviews r
        where r.event_id = e.id and r.user_id = b.user_id
          and r.deleted_at is null
      )
  )
  select d.bid, d.k, s.endpoint, s.p256dh, s.auth, s.platform,
    case d.k
      when 'expiring' then '자리가 곧 풀려요'
      when 'today'    then '오늘이에요'
      when 'review'   then '어젯밤 어땠어요?'
      else '내일 예약된 파티예요'
    end,
    case d.k
      when 'expiring' then
        d.ev_title || ' · ' || d.code || ' 입금이 아직이에요. 세 시간 뒤 자동 취소됩니다.'
      when 'today' then
        d.ev_title || ' · 오늘 ' || d.at_time ||
        chr(10) || d.venue ||
        coalesce(chr(10) || nullif(trim(d.addr), ''), '') ||
        chr(10) || '예매번호 ' || d.code || ' · 입구에서 보여 주세요'
      when 'review' then
        d.ev_title || chr(10) ||
        '후기 한 줄이 다음에 갈 사람에게 제일 큰 도움이 됩니다'
      else
        d.ev_title || ' · 내일 ' || d.at_time ||
        chr(10) || d.venue ||
        coalesce(chr(10) || nullif(trim(d.addr), ''), '') ||
        chr(10) || '예매번호 ' || d.code || ' · 입구에서 보여 주세요'
    end,
    case d.k when 'review' then '/party/' || (
      select slug from events where id = (
        select event_id from bookings where id = d.bid
      )
    ) else '/tickets' end
  from due d
  join push_subscriptions s on s.user_id = d.uid and s.failed_at is null
  where not exists (
    select 1 from push_log l where l.booking_id = d.bid and l.kind = d.k
  );
end $fn$;

revoke all on function push_targets from public, anon, authenticated;


-- ─────────────────────────────────────────── 3. 찜 알림용 로그
create table if not exists push_log_fav (
  user_id  uuid not null references auth.users on delete cascade,
  event_id uuid not null references events on delete cascade,
  kind     text not null check (kind in ('closing')),
  sent_at  timestamptz default now(),
  primary key (user_id, event_id, kind)
);

-- 정책 없이 켠다. 서비스 롤만 지나가면 되고 손님이 볼 이유가 없는 표다
alter table push_log_fav enable row level security;


-- ─────────────────────────────────────────── 4. 찜한 파티가 얼마 안 남았다
--
-- **광고성으로 볼 여지가 있다.** 본인이 찜한 것이라 정보성으로 볼 수도
-- 있지만 다투기 싫어서, marketing_push 에 동의한 사람에게만 보내고
-- 21~08시를 피한다(정보통신망법 50조).
--
-- 이미 예매한 사람에게는 안 보낸다 — 다 산 사람에게 사라고 하는 꼴이다.

create or replace function push_targets_fav()
returns table (
  user_id  uuid,
  event_id uuid,
  kind     text,
  endpoint text,
  p256dh   text,
  auth     text,
  platform text,
  title    text,
  body     text,
  url      text
)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  v_hour int := extract(hour from (now() at time zone 'Asia/Seoul'));
begin
  -- 밤에는 아예 아무것도 안 돌린다
  if v_hour < 8 or v_hour >= 21 then
    return;
  end if;

  return query
  with due as (
    select f.user_id as uid, e.id as eid, e.title as ev_title, e.slug as ev_slug,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'MM/DD') as at_day,
           to_char(e.starts_at at time zone 'Asia/Seoul', 'HH24:MI') as at_time,
           (st.capacity - st.booked) as left_seats
    from favorites f
    join events e on e.id = f.event_id
    join event_stats st on st.event_id = e.id
    join profiles p on p.user_id = f.user_id
    where e.status = 'open'
      and e.starts_at > now()
      -- 광고성 동의자에게만
      and p.marketing_push
      -- **얼마 안 남았을 때만.** 여유 있을 때 보내면 그냥 광고다
      and st.capacity - st.booked between 1 and 5
      -- 이미 예매한 사람에게는 안 보낸다
      and not exists (
        select 1 from bookings b
        where b.event_id = e.id and b.user_id = f.user_id
          and b.status <> 'cancelled'
      )
      and not exists (
        select 1 from push_log_fav l
        where l.user_id = f.user_id and l.event_id = e.id and l.kind = 'closing'
      )
  )
  select d.uid, d.eid, 'closing'::text, s.endpoint, s.p256dh, s.auth, s.platform,
    '찜한 파티가 ' || d.left_seats || '자리 남았어요',
    d.ev_title || ' · ' || d.at_day || ' ' || d.at_time,
    '/party/' || d.ev_slug
  from due d
  join push_subscriptions s on s.user_id = d.uid and s.failed_at is null;
end $fn$;

revoke all on function push_targets_fav from public, anon, authenticated;


-- ─────────────────────────────────────────── 5. 확인
select kind, count(*) as 건수 from push_targets() group by kind order by kind;
select kind, count(*) as 건수 from push_targets_fav() group by kind;
