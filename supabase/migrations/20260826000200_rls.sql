-- RLS. 사양서 5절 마지막 문단.
--
-- 기본은 전부 잠그고 필요한 것만 연다. 특히 bookings 는 **직접 insert 를
-- 허용하지 않는다** — 예매는 create_booking RPC 로만 들어온다. 정책으로
-- insert 를 열면 정원 검사를 건너뛰는 길이 생긴다.

alter table crews enable row level security;
alter table crew_members enable row level security;
alter table events enable row level security;
alter table ticket_tiers enable row level security;
alter table lineups enable row level security;
alter table bookings enable row level security;
alter table favorites enable row level security;
alter table crew_follows enable row level security;

-- ─────────────────────────────────────────── 헬퍼
--
-- 정책 안에서 crew_members 를 직접 조회하면 그 테이블의 정책이 다시 걸려
-- 무한 재귀가 난다. security definer 함수로 한 번 빠져나간다.

create or replace function is_crew_staff(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from crews where id = p_crew_id and owner_id = auth.uid()
  ) or exists (
    select 1 from crew_members
    where crew_id = p_crew_id and user_id = auth.uid()
  );
$fn$;

create or replace function is_event_staff(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from events e
    where e.id = p_event_id and is_crew_staff(e.crew_id)
  );
$fn$;

-- ─────────────────────────────────────────── 크루

create policy crews_read on crews
  for select using (true);

create policy crews_insert on crews
  for insert with check (owner_id = auth.uid());

create policy crews_write on crews
  for update using (owner_id = auth.uid());

create policy crews_delete on crews
  for delete using (owner_id = auth.uid());

-- 멤버 목록은 공개하지 않는다. 초대 코드가 정산 근거라 노출되면 곤란하다
create policy crew_members_read on crew_members
  for select using (is_crew_staff(crew_id));

create policy crew_members_write on crew_members
  for all using (
    exists (select 1 from crews where id = crew_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from crews where id = crew_id and owner_id = auth.uid())
  );

-- ─────────────────────────────────────────── 파티

create policy events_read_open on events
  for select using (status = 'open' or is_crew_staff(crew_id));

create policy events_write on events
  for all using (is_crew_staff(crew_id)) with check (is_crew_staff(crew_id));

create policy tiers_read on ticket_tiers
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status = 'open' or is_crew_staff(e.crew_id))
    )
  );

create policy tiers_write on ticket_tiers
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

create policy lineups_read on lineups
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status = 'open' or is_crew_staff(e.crew_id))
    )
  );

create policy lineups_write on lineups
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─────────────────────────────────────────── 예매
--
-- insert 정책이 **없다.** 일부러 그렇다. create_booking(security definer)
-- 만이 행을 만든다.

create policy bookings_read_own on bookings
  for select using (
    (user_id is not null and user_id = auth.uid()) or is_event_staff(event_id)
  );

create policy bookings_update_staff on bookings
  for update using (is_event_staff(event_id))
  with check (is_event_staff(event_id));

-- ─────────────────────────────────────────── 찜 · 팔로우

create policy favorites_own on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy follows_own on crew_follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────── 집계 뷰
--
-- **일부러 security invoker 를 켜지 않는다.** 켜면 anon 이 event_stats 를
-- 읽으려고 bookings 전체 읽기 권한을 가져야 한다 — 개인 예매가 새어 나간다.
-- 뷰는 소유자 권한으로 돌고 **합계만** 돌려준다. "21자리 남았어요" 는
-- 어차피 공개 정보다.

grant select on event_stats to anon, authenticated;
grant select on tier_stats to anon, authenticated;
