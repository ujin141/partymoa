-- 테이블 예약 (VIP · VVIP · PLUS).
--
-- 차수(ticket_tiers)와 다른 것이다. 차수는 입장권이고, 테이블은 자리를
-- 통째로 잡는 것이며 **테이블을 잡으면 입장비가 없다.** 같은 표에 섞으면
-- 정원 계산이 깨진다 — 테이블 손님은 입장권을 안 사기 때문이다.
--
-- 값은 크루가 앱에서 넣는다. 여기에 미리 적어 두지 않는다 — 파티마다
-- 다르고, 코드에 박아 두면 바꿀 때마다 배포해야 한다.

create table if not exists event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  name  text not null,               -- VIP · VVIP · PLUS
  -- 계좌이체 기준. 메뉴판이 그렇게 적혀 있다
  price int not null check (price >= 0),
  -- 카드로 결제하면 더 받는다. 비우면 안 띄운다
  card_price int check (card_price is null or card_price >= 0),
  -- 몇 명까지 앉나. 입장비가 없는 인원이 이 숫자다
  seats int not null check (seats > 0),
  note  text,                        -- 구성 (주류·안주 등)
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- 테이블 전체에 공통으로 붙는 안내 (샴페인 종류·추가 가격·예약 문의 등).
-- 줄마다 반복하면 화면이 같은 말로 도배된다
alter table events add column if not exists tables_note text;

create index if not exists event_tables_event_idx
  on event_tables (event_id, sort_order);

alter table event_tables enable row level security;

-- 손님이 봐야 파는 것이다. 파티가 보이면 테이블도 보인다
drop policy if exists event_tables_read on event_tables;
create policy event_tables_read on event_tables
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id and (e.status in ('open', 'closed', 'done')
        or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_tables_write on event_tables;
create policy event_tables_write on event_tables
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );
