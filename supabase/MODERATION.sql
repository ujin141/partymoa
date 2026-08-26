-- ═══════════════════════════════════════════════════════════════════
--  신고와 차단
--
--  **구글 플레이가 요구합니다.** 사용자끼리 글을 주고받는 앱은 신고할
--  길과 차단할 길이 있어야 합니다. 없으면 UGC 정책으로 반려됩니다.
--
--  두 가지를 만듭니다.
--
--   1. 신고 — 운영자에게 알린다. 글은 그대로 있고, 운영자가 보고 지운다
--   2. 차단 — 그 사람 글이 나에게만 안 보인다. 즉시 효과가 있어야 한다
--
--  **차단은 신고보다 중요합니다.** 신고는 사람이 확인할 때까지 시간이
--  걸리지만, 차단은 누르는 즉시 그 사람이 사라집니다. 불쾌한 걸 본
--  사람이 지금 당장 원하는 건 그쪽입니다.
--
--  두 번 돌려도 안전합니다.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────── 신고

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  -- 'post' 또는 'comment'
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid references auth.users on delete set null,
  reason text not null check (char_length(reason) between 1 and 300),
  -- 운영자가 처리한 시각. 비어 있으면 아직 안 본 것
  handled_at timestamptz,
  created_at timestamptz default now(),
  -- 한 사람이 같은 글을 여러 번 신고해도 한 줄이다
  unique (target_type, target_id, reporter_id)
);

create index if not exists reports_open_idx
  on content_reports (created_at desc) where handled_at is null;

alter table content_reports enable row level security;

-- 신고는 누구나 넣을 수 있다. **읽는 건 운영자만** — 누가 누구를
-- 신고했는지가 서로에게 보이면 보복이 된다
drop policy if exists reports_insert on content_reports;
create policy reports_insert on content_reports
  for insert with check (reporter_id = auth.uid());

drop policy if exists reports_admin on content_reports;
create policy reports_admin on content_reports
  for all using (is_app_admin()) with check (is_app_admin());

-- ─────────────────────────────────────────── 차단

create table if not exists user_blocks (
  user_id uuid references auth.users on delete cascade not null,
  blocked_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, blocked_id),
  -- 자기 자신은 못 막는다
  check (user_id <> blocked_id)
);

alter table user_blocks enable row level security;

-- 내 차단 목록은 나만 본다. 상대는 자기가 차단당한 걸 알 수 없다 —
-- 알게 하면 그게 또 시비가 된다
drop policy if exists blocks_own on user_blocks;
create policy blocks_own on user_blocks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 신고하기

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

  insert into content_reports (target_type, target_id, reporter_id, reason)
  values (p_type, p_id, v_me, left(trim(p_reason), 300))
  on conflict (target_type, target_id, reporter_id)
  do update set reason = excluded.reason, created_at = now();

  return true;
end $fn$;

revoke all on function report_content from public;
grant execute on function report_content to anon, authenticated;

-- ─────────────────────────────────────────── 차단하기
--
--  글 id 로 받습니다. 앱이 상대의 user_id 를 알 필요가 없게 하려는
--  것입니다 — 화면에 남의 계정 id 를 흘리지 않습니다.

create or replace function block_author(p_type text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me     uuid := auth.uid();
  v_author uuid;
begin
  if v_me is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;

  if p_type = 'post' then
    select user_id into v_author from posts where id = p_id;
  elsif p_type = 'comment' then
    select user_id into v_author from post_comments where id = p_id;
  else
    raise exception 'BAD_TARGET' using errcode = 'P0001';
  end if;

  if v_author is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_author = v_me then
    raise exception 'SELF' using errcode = 'P0001';
  end if;

  insert into user_blocks (user_id, blocked_id)
  values (v_me, v_author)
  on conflict do nothing;

  return true;
end $fn$;

revoke all on function block_author from public;
grant execute on function block_author to anon, authenticated;

create or replace function unblock_all()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare v_n int;
begin
  delete from user_blocks where user_id = auth.uid();
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

revoke all on function unblock_all from public;
grant execute on function unblock_all to anon, authenticated;

-- ─────────────────────────────────────────── 차단한 사람은 안 보인다
--
--  RLS 로 막습니다. 앱이 걸러 내면 화면마다 빠뜨릴 자리가 생기고,
--  한 군데만 빠뜨려도 차단이 안 되는 것처럼 보입니다.

create or replace function is_blocked(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from user_blocks
    where user_id = auth.uid() and blocked_id = p_author
  );
$fn$;

drop policy if exists posts_read on posts;
create policy posts_read on posts
  for select using (deleted_at is null and not is_blocked(user_id));

drop policy if exists comments_read on post_comments;
create policy comments_read on post_comments
  for select using (deleted_at is null and not is_blocked(user_id));

-- ─────────────────────────────────────────── 운영자가 보는 신고함

drop view if exists open_reports cascade;
create view open_reports as
select r.id,
       r.target_type,
       r.target_id,
       r.reason,
       r.created_at,
       coalesce(p.nickname, c.nickname) as author,
       coalesce(p.body, c.body)         as body,
       coalesce(p.id, c.post_id)        as post_id
from content_reports r
left join posts p         on r.target_type = 'post'    and p.id = r.target_id
left join post_comments c on r.target_type = 'comment' and c.id = r.target_id
where r.handled_at is null
order by r.created_at desc;

grant select on open_reports to authenticated;

-- ─────────────────────────────────────────── 확인

select to_regclass('public.content_reports') is not null as 신고표,
       to_regclass('public.user_blocks')     is not null as 차단표,
       to_regclass('public.open_reports')    is not null as 신고함;
