-- 요청 제한.
--
-- **제일 큰 구멍은 예매다.** 예매는 로그인 없이 받고, 신청하면 24시간
-- 자리를 잡는다. 그래서 누구든 스크립트로 80석을 통째로 잠글 수 있다.
-- 돈 한 푼 안 들이고 파티 하나를 죽이는 방법이다.
--
-- 다음은 티켓 찾기다. 예매번호가 PM0001 부터 순서라 번호를 돌려 가며
-- 전화번호를 맞춰 보면 남의 예매를 열 수 있다.
--
-- Vercel 함수는 요청마다 새로 뜨므로 메모리에 세어 봐야 소용이 없다.
-- 세는 자리는 DB 한 곳이어야 한다.

create table if not exists rate_hits (
  bucket text not null,
  window_at timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_at)
);

-- 오래된 줄은 쌓아 둘 이유가 없다
create index if not exists rate_hits_window_idx on rate_hits (window_at);

alter table rate_hits enable row level security;
-- 아무도 직접 못 읽고 못 쓴다. 아래 함수만 만진다
drop policy if exists rate_hits_none on rate_hits;
create policy rate_hits_none on rate_hits for select using (false);

/**
 * 한 번 세고, 넘었으면 false.
 *
 * 창을 고정 구간으로 자른다(초 단위 내림). 미끄러지는 창보다 거칠지만
 * 줄 하나로 끝나서 빠르고, 우리가 막으려는 건 정밀한 조절이 아니라
 * 기계로 쏟아붓는 것이다.
 */
create or replace function rate_ok(p_bucket text, p_limit int, p_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_win timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_seconds) * p_seconds
  );
  v_hits int;
begin
  insert into rate_hits (bucket, window_at, hits)
  values (p_bucket, v_win, 1)
  on conflict (bucket, window_at)
  do update set hits = rate_hits.hits + 1
  returning hits into v_hits;

  -- 지나간 창은 버린다. 자주 안 해도 되므로 가끔만
  if random() < 0.01 then
    delete from rate_hits where window_at < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end $fn$;

revoke all on function rate_ok from public;
grant execute on function rate_ok to anon, authenticated;
