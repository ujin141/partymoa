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
