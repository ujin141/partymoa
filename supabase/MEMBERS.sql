-- 가입자 목록: 익명 세션을 DB 에서 먼저 거른다.
--
-- 전에는 최신 500명을 자른 뒤 화면에서 익명을 뺐다. 로그인 없이 둘러본
-- 기기마다 익명 계정이 하나씩 생기니 500개가 거의 익명으로 차고,
-- 오래된 진짜 회원은 잘려서 "가입자가 전부 안 보이는" 상태가 됐다.
--
-- Supabase SQL Editor 에 통째로 붙여 넣고 Run.

drop function if exists member_list(text);

create or replace function member_list(p_q text default null, p_anon boolean default false)
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
  where (p_anon or not coalesce(u.is_anonymous, false))
    and (v_q is null
     or u.email ilike '%' || v_q || '%'
     or p.nickname ilike '%' || v_q || '%'
     or p.real_name ilike '%' || v_q || '%'
     or p.phone like '%' || v_q || '%')
  order by u.created_at desc
  limit 500;
end $fn$;

revoke all on function member_list(text, boolean) from public, anon;
grant execute on function member_list(text, boolean) to authenticated;

-- 확인: 회원 수와 목록 수가 같아야 한다 (500 미만이면)
select (select people from member_summary()) as 회원,
       (select count(*) from member_list(null, false)) as 목록;
