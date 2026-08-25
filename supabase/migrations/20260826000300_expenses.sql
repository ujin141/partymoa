-- 정산 지출. 사양서 6절의 "대관료 (크루 입력)" 이 들어갈 자리가
-- 5절 스키마에 없었다. 행 단위로 두면 대관료·홍보비 말고 다른 항목이
-- 생겨도 스키마를 안 고친다.

create table event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  label text not null,
  amount int not null check (amount >= 0),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index event_expenses_event_idx on event_expenses (event_id, sort_order);

alter table event_expenses enable row level security;

create policy expenses_staff on event_expenses
  for all using (is_event_staff(event_id))
  with check (is_event_staff(event_id));
