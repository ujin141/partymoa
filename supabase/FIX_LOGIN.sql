-- 구글 로그인이 로그아웃 상태로 돌아오던 것 — 이 한 덩어리만 먼저
-- 돌리면 바로 고쳐집니다. (APPLY.sql 에도 같은 게 들어 있습니다)

create or replace function promote_anonymous()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_id  uuid := auth.uid();
  v_has boolean;
begin
  if v_id is null then
    return false;
  end if;

  select exists (
    select 1 from auth.identities i
    where i.user_id = v_id and i.provider <> 'anonymous'
  ) into v_has;

  if not v_has then
    return false;
  end if;

  update auth.users
  set is_anonymous = false, updated_at = now()
  where id = v_id and is_anonymous;

  return found;
end $fn$;

revoke all on function promote_anonymous from public, anon;
grant execute on function promote_anonymous to authenticated;

-- 이미 구글을 붙였는데 익명으로 남아 있는 계정들을 한 번에 풀어 준다.
-- (이미 로그인 시도했던 사람들)
update auth.users u
set is_anonymous = false, updated_at = now()
where u.is_anonymous
  and exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider <> 'anonymous'
  );

select count(*) filter (where is_anonymous) as 익명,
       count(*) filter (where not is_anonymous) as 진짜계정
from auth.users;
