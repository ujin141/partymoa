-- 커뮤니티 자유 게시판.
--
-- 글쓰기는 RPC 로만 들어온다. insert 정책을 열면 닉네임·본문 길이 검사와
-- 도배 방지를 우회하는 길이 생긴다 — 예매와 같은 원칙이다.
--
-- user_id 가 null 일 수 있다. 익명 로그인을 안 켠 프로젝트에서도 글은
-- 써지게 하되, 그런 글은 본인이 지울 수 없다(누가 본인인지 알 수 없으므로).

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  nickname text not null,
  body text not null,
  event_id uuid references events on delete set null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index posts_live_idx on posts (created_at desc) where deleted_at is null;
create index posts_user_idx on posts (user_id, created_at desc);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users,
  nickname text not null,
  body text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index post_comments_post_idx on post_comments (post_id, created_at);

-- 목록에서 댓글 수를 세려고 매번 조인하지 않는다
create view post_list as
select
  p.id, p.user_id, p.nickname, p.body, p.event_id, p.created_at,
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

alter table posts enable row level security;
alter table post_comments enable row level security;

create policy posts_read on posts
  for select using (deleted_at is null);

create policy posts_own_write on posts
  for update using (user_id is not null and user_id = auth.uid())
  with check (user_id is not null and user_id = auth.uid());

create policy comments_read on post_comments
  for select using (deleted_at is null);

create policy comments_own_write on post_comments
  for update using (user_id is not null and user_id = auth.uid())
  with check (user_id is not null and user_id = auth.uid());

grant select on post_list to anon, authenticated;

-- ─────────────────────────────────────────── 쓰기

create or replace function create_post(
  p_nickname text,
  p_body text,
  p_event_id uuid default null
) returns posts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nick text;
  v_body text;
  v_row posts;
begin
  v_nick := nullif(trim(p_nickname), '');
  v_body := nullif(trim(p_body), '');
  if v_nick is null or length(v_nick) > 20 then
    raise exception 'BAD_NICKNAME' using errcode = 'P0001';
  end if;
  if v_body is null or length(v_body) > 2000 then
    raise exception 'BAD_BODY' using errcode = 'P0001';
  end if;

  -- 도배 방지. 같은 글을 연달아 올리는 걸 막는다
  if exists (
    select 1 from posts
    where nickname = v_nick and body = v_body
      and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'DUPLICATE' using errcode = 'P0001';
  end if;

  insert into posts (user_id, nickname, body, event_id)
  values (auth.uid(), v_nick, v_body, p_event_id)
  returning * into v_row;
  return v_row;
end $fn$;

create or replace function create_comment(
  p_post_id uuid,
  p_nickname text,
  p_body text
) returns post_comments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nick text;
  v_body text;
  v_row post_comments;
begin
  v_nick := nullif(trim(p_nickname), '');
  v_body := nullif(trim(p_body), '');
  if v_nick is null or length(v_nick) > 20 then
    raise exception 'BAD_NICKNAME' using errcode = 'P0001';
  end if;
  if v_body is null or length(v_body) > 1000 then
    raise exception 'BAD_BODY' using errcode = 'P0001';
  end if;
  if not exists (select 1 from posts where id = p_post_id and deleted_at is null) then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into post_comments (post_id, user_id, nickname, body)
  values (p_post_id, auth.uid(), v_nick, v_body)
  returning * into v_row;
  return v_row;
end $fn$;

-- 지우기는 본인만. 행을 없애지 않고 표시만 한다 — 댓글이 붕 뜨지 않게
create or replace function delete_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;
  update posts set deleted_at = now()
  where id = p_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
end $fn$;

create or replace function delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = 'P0001';
  end if;
  update post_comments set deleted_at = now()
  where id = p_id and user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'NOT_YOURS' using errcode = 'P0001';
  end if;
end $fn$;

revoke all on function create_post, create_comment, delete_post, delete_comment from public;
grant execute on function create_post, create_comment, delete_post, delete_comment
  to anon, authenticated;
