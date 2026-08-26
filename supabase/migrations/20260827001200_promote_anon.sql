-- 익명 계정을 진짜 계정으로 승격한다.
--
-- **이게 "구글 로그인은 됐는데 로그아웃 상태" 의 원인이다.**
--
-- 이 앱은 첫 방문에 익명 세션을 만든다(로그인 없이 예매하려고). 그
-- 상태에서 구글 로그인을 누르면 signInWithOAuth 가 아니라 linkIdentity
-- 로 간다 — 익명으로 잡아 둔 예매를 잃지 않으려고 그렇게 짰다.
--
-- 그런데 linkIdentity 는 구글 신원을 **붙이기만 하고** auth.users 의
-- is_anonymous 를 그대로 둔다. 앱은 `user && !user.is_anonymous` 로
-- 로그인 여부를 보므로, 구글 창까지 다 돌고 와도 여전히 로그아웃이다.
--
-- 그래서 콜백에서 이 함수를 부른다. **신원이 실제로 붙어 있을 때만**
-- 표시를 내린다 — 아무나 부른다고 익명이 풀리면 안 된다.

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

  -- 익명이 아닌 신원(구글·카카오·애플·이메일)이 붙어 있는가
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
