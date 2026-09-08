-- ═══════════════════════════════════════════════════════════════════
--  HARDEN2 — 레드팀 1라운드에서 뚫린 자리를 막는다
--
--  HARDEN.sql 다음에 한 번 돌린다. 몇 번 돌려도 같은 결과다.
--
--  뚫린 곳
--   1. crews_insert 정책이 "owner_id = 본인" 만 봐서, 익명 세션까지
--      크루를 만들고 → 그 크루의 스태프가 되어 → 가짜 파티를 open 으로
--      홈에 올릴 수 있었다. 입금 계좌도 자기 것으로.
--   2. create_booking 을 anon 키로 직접 부르면 라우트의 IP 제한과
--      번호 형식 검사를 다 건너뛴다. 번호를 매번 바꾸면 번호당 제한도
--      안 걸려서 10분에 60석을 24시간 잠글 수 있었다.
--   3. can_review 가 "취소 아닌 예매" 만 봐서, 입금 안 한 예매 하나로
--      별점을 쓸 수 있었다.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────── 1. 크루는 운영자만 만든다
--
--  크루는 신청(crew_applications) → 운영자 승인으로만 생긴다. 앱 코드는
--  이미 그렇게만 만든다(crews_admin_write). 손님이 직접 insert 할 길을
--  정책에서 아예 지운다.

drop policy if exists crews_insert on crews;

-- owner 가 update 로 owner_id 를 바꾸는 것도 막는다.
-- with check 가 없으면 using 만 통과하고 아무 값이나 쓸 수 있다
drop policy if exists crews_write on crews;
create policy crews_write on crews
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ─────────────────────────────────────────── 2. 예매는 서버 라우트로만
--
--  create_booking 을 anon·authenticated 에서 회수한다. 이제 /api/bookings
--  가 service_role 로 부른다. 그래야 IP 제한·번호 형식 검사가 실제로 걸린다.
--
--  service_role 로 돌면 auth.uid() 가 비어서 예매가 계정에 안 붙는다.
--  라우트가 손님 uid 를 p_user_id 로 넘긴다. 이 인자는 service_role 만
--  부를 수 있으니 남의 uid 를 넣을 수 있는 쪽은 우리 서버뿐이다.

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
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;
  if p_quantity < 1 or p_quantity > 4 then
    raise exception 'BAD_QUANTITY' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_name, ''))) < 1 or length(p_name) > 40 then
    raise exception 'BAD_NAME' using errcode = 'P0001';
  end if;

  -- 번호 형식은 여기서도 본다. 라우트를 안 거친 호출이 있어도 같은 잣대
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

  if exists (
    select 1
    from bookings b
    where b.event_id = p_event_id
      and regexp_replace(b.phone, '[^0-9]', '', 'g') = v_digits
      and (
        b.status in ('paid', 'checked_in')
        or (b.status = 'pending' and b.expires_at > now())
      )
  ) then
    raise exception 'ALREADY_BOOKED' using errcode = 'P0001';
  end if;

  -- 한 계정이 입금 없이 잡아 둘 수 있는 자리는 두 건까지.
  -- 번호를 바꿔 가며 잡는 스크립트는 여기서 걸린다
  if v_uid is not null and (
    select count(*) from bookings b
    where b.user_id = v_uid and b.status = 'pending' and b.expires_at > now()
  ) >= 2 then
    raise exception 'RATE' using errcode = 'P0001';
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

-- 8개짜리가 남으면 PostgREST 가 어느 쪽인지 못 고른다
drop function if exists create_booking(uuid, uuid, text, text, text, int, text, text);

revoke all on function
  create_booking(uuid, uuid, text, text, text, int, text, text, uuid)
  from public, anon, authenticated;
grant execute on function
  create_booking(uuid, uuid, text, text, text, int, text, text, uuid)
  to service_role;

-- insert 트리거도 번호를 본다. 어느 길로 들어오든 표에 쓰는 순간은 하나
create or replace function _bookings_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_digits text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  if is_event_staff(new.event_id) or is_app_admin() then
    return new;
  end if;
  if length(v_digits) < 8 or length(v_digits) > 15 then
    raise exception 'BAD_PHONE' using errcode = 'P0001';
  end if;
  if not _rate_hit('book:phone:' || v_digits, 3, 3600)
     or not _rate_hit('book:all', 60, 600) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

-- ─────────────────────────────────────────── 3. 후기는 온 사람만
--
--  입금 확인(paid) 또는 입장(checked_in) 된 예매가 있어야 쓴다.
--  입금 없는 pending 예매 하나로 별점을 쓰던 길을 닫는다.

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
      and b.status in ('paid', 'checked_in')
      and e.starts_at <= now()
  );
$fn$;

-- ─────────────────────────────────────────── 확인
--  create_booking 은 service_role 만 true 여야 한다
select r.rolname, has_function_privilege(r.rolname, p.oid, 'execute') as can_call
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
where n.nspname = 'public' and p.proname = 'create_booking';


-- ═══════════════════════════════════════════════════════════════════
--  2라운드. 아래도 같은 파일에서 이어 돌린다.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────── 4. 신고함은 운영자만
--
--  open_reports 가 정의자 권한으로 돌아서 content_reports 의 "운영자만"
--  정책을 건너뛰었다. 로그인한 사람 아무나 신고 내용을 읽을 수 있었다.
--  호출자 권한으로 돌리면 reports_admin 정책이 그대로 걸린다.

alter view open_reports set (security_invoker = on);

-- ─────────────────────────────────────────── 5. 수정으로 검사를 피하는 길
--
--  후기: insert 에만 can_review 를 걸어 두어서, 정당한 후기 하나를 만든 뒤
--  event_id 를 남의 파티로 바꾸면 안 간 파티에 별점을 쓸 수 있었다.
--  글·댓글: 앱에 수정 기능이 없다. 그런데 update 정책이 열려 있어서
--  길이 제한도, 속도 제한도 없이 본문을 갈아 끼울 수 있었다. 닫는다.

drop policy if exists reviews_own_edit on reviews;
create policy reviews_own_edit on reviews
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and can_review(event_id)
    and length(body) between 1 and 1000
    and length(nickname) between 1 and 20
  );

drop policy if exists posts_own_write on posts;
drop policy if exists comments_own_write on post_comments;

-- ─────────────────────────────────────────── 6. 신고는 함수로만, 속도 제한
--
--  표에 직접 insert 하는 정책을 지운다. report_content 만 남긴다.
--  10분에 5건. 없는 대상은 받지 않는다 — 빈 신고로 신고함을 덮는 길.

drop policy if exists reports_insert on content_reports;

create or replace function report_content(
  p_type text,
  p_id uuid,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_exists boolean;
begin
  if v_me is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;
  if p_type not in ('post', 'comment') then
    raise exception 'BAD_TARGET' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'BAD_REASON' using errcode = 'P0001';
  end if;
  if p_type = 'post' then
    select exists (select 1 from posts where id = p_id and deleted_at is null) into v_exists;
  else
    select exists (select 1 from post_comments where id = p_id and deleted_at is null) into v_exists;
  end if;
  if not v_exists then
    raise exception 'BAD_TARGET' using errcode = 'P0001';
  end if;
  if not _rate_hit('report:' || v_me::text, 5, 600) then
    raise exception 'RATE' using errcode = 'P0001';
  end if;

  insert into content_reports (target_type, target_id, reporter_id, reason)
  values (p_type, p_id, v_me, left(trim(p_reason), 300))
  on conflict (target_type, target_id, reporter_id)
  do update set reason = excluded.reason, created_at = now();

  return true;
end $fn$;

-- ─────────────────────────────────────────── 7. 글쓴이 uuid 를 표에서 뗀다
--
--  HARDEN 이 post_list 뷰에서는 user_id 를 뺐지만 posts·post_comments·
--  reviews 표를 직접 읽으면 그대로 나왔다. 닉네임을 바꿔 가며 쓴 글을
--  uuid 하나로 다 묶을 수 있었다 — 익명 게시판이 익명이 아니게 된다.
--
--  칼럼 단위로 권한을 준다. user_id 만 뺀다. 앱은 뷰(post_list ·
--  comment_list · review_list)로 읽고, 뷰가 "내 글인가" 를 대신 답한다.
--
--  그리고 HARDEN 의 post_list 는 차단(is_blocked) 필터가 빠져 있었다.
--  정의자 권한 뷰라 posts_read 정책을 안 타서, 차단한 사람 글이 도로
--  보였다. 여기서 같이 고친다.

revoke select on posts from anon, authenticated;
grant select (id, nickname, body, event_id, created_at, deleted_at)
  on posts to anon, authenticated;

revoke select on post_comments from anon, authenticated;
grant select (id, post_id, nickname, body, created_at, deleted_at)
  on post_comments to anon, authenticated;

revoke select on reviews from anon, authenticated;
grant select (id, event_id, rating, body, nickname, created_at, deleted_at)
  on reviews to anon, authenticated;

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
where p.deleted_at is null
  and not is_blocked(p.user_id);
grant select on post_list to anon, authenticated;

drop view if exists comment_list cascade;
create view comment_list as
select
  c.id, c.post_id, c.nickname, c.body, c.created_at,
  (c.user_id is not null and c.user_id = auth.uid()) as mine,
  (c.user_id is null) as anon
from post_comments c
where c.deleted_at is null
  and not is_blocked(c.user_id);
grant select on comment_list to anon, authenticated;

drop view if exists review_list cascade;
create view review_list as
select
  r.id, r.event_id, r.rating, r.body, r.nickname, r.created_at,
  (r.user_id = auth.uid()) as mine
from reviews r
where r.deleted_at is null;
grant select on review_list to anon, authenticated;

-- ─────────────────────────────────────────── 8. 푸시 구독은 한 사람 5줄
--
--  익명 세션을 무한히 만들어 아무 주소나 endpoint 로 넣으면 표가 붓고,
--  광고 발송이 그 주소들로 한 번씩 나간다. 한 계정 5줄이면 기기 셋에
--  브라우저 둘까지 넉넉하다. 주소 자체는 라우트가 거른다.

create or replace function _push_subs_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.user_id is not null and (
    select count(*) from push_subscriptions where user_id = new.user_id
  ) >= 5 then
    raise exception 'RATE' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists push_subs_cap on push_subscriptions;
create trigger push_subs_cap
  before insert on push_subscriptions
  for each row execute function _push_subs_cap();

-- ─────────────────────────────────────────── 확인 2
--  posts.user_id 를 anon 이 못 읽어야 한다 (false 두 줄)
select r.rolname,
       has_column_privilege(r.rolname, 'public.posts', 'user_id', 'select') as posts_uid,
       has_column_privilege(r.rolname, 'public.posts', 'body', 'select') as posts_body
from (values ('anon'), ('authenticated')) as r(rolname);
