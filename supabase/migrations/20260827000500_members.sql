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
