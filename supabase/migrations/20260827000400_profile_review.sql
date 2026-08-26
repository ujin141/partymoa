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

-- ─────────────────────────────────────────── 취향
--
-- 처음 들어온 사람에게 무엇을 먼저 보여 줄지 정할 근거가 없었다.
-- 지역과 카테고리만 받는다 — 더 물으면 시작 화면이 길어지고, 길면
-- 건너뛴다. 비어 있으면 예전처럼 전체를 보여 준다.
alter table profiles add column if not exists areas      text[] not null default '{}';
alter table profiles add column if not exists categories text[] not null default '{}';
-- 시작 화면을 봤는지. 취향을 안 골라도 다시 안 띄운다
alter table profiles add column if not exists onboarded_at timestamptz;
