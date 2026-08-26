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
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

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
    coalesce(p.areas, '{}'),
    coalesce(p.categories, '{}'),
    coalesce(b.cnt, 0)::int,
    coalesce(b.paid, 0)::bigint
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join (
    select user_id,
           count(*) filter (where status <> 'cancelled') as cnt,
           sum(amount) filter (where status in ('paid', 'checked_in')) as paid
    from bookings
    where user_id is not null
    group by user_id
  ) b on b.user_id = u.id
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
begin
  if not is_app_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return query
  select
    count(*) filter (where not coalesce(u.is_anonymous, false))::int,
    count(*) filter (where coalesce(u.is_anonymous, false))::int,
    count(*) filter (where u.raw_app_meta_data ->> 'provider' = 'google')::int,
    (select count(*) from profiles)::int,
    (select count(distinct user_id) from bookings
     where user_id is not null and status <> 'cancelled')::int
  from auth.users u;
end $fn$;

revoke all on function member_summary from public, anon;
grant execute on function member_summary to authenticated;
