-- 파티 사진.
--
-- 커버 한 장으로는 "어떤 파티인지" 가 안 전해진다. 낮의 물, 밤의 조명,
-- DJ, 루프탑 — 다 다른 장면인데 한 장만 보고 정해야 했다.
--
-- 커버와 따로 둔다. 커버는 목록 카드에 쓰는 대표 한 장이고, 여기는
-- 상세에서만 보는 여러 장이다.

create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade not null,
  url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists event_photos_event_idx
  on event_photos (event_id, sort_order);

alter table event_photos enable row level security;

drop policy if exists event_photos_read on event_photos;
create policy event_photos_read on event_photos
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (e.status in ('open', 'closed', 'done') or is_crew_staff(e.crew_id))
    )
  );

drop policy if exists event_photos_write on event_photos;
create policy event_photos_write on event_photos
  for all using (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_crew_staff(e.crew_id))
  );
