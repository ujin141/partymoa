-- ═══════════════════════════════════════════════════════════════════
--  라인업 교체
--
--  지금 스키마는 **시작 시각만** 받는다. 끝 시각과 '솔로파티' 같은
--  구간 표시는 자리가 없어서 못 넣는다. 21:30~23:00 이 솔로파티 구간인데
--  화면에는 그 안의 DJ 세 팀만 순서대로 보인다.
--
--  기존 라인업을 지우고 새로 넣는다. 예매가 라인업을 참조하지 않으므로
--  통째로 갈아도 안전하다.
-- ═══════════════════════════════════════════════════════════════════

do $ln$
declare
  v_event uuid;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  delete from lineups where event_id = v_event;

  insert into lineups (event_id, artist_name, starts_at, sort_order) values
      (v_event, 'TS',             '19:00', 0),
      (v_event, 'LYNN',           '19:30', 1),
      (v_event, 'V',              '20:00', 2),
      (v_event, 'CHIPS',          '20:30', 3),
      (v_event, 'HEIDY',          '21:00', 4),
      (v_event, 'XANTHIC',        '21:30', 5),
      (v_event, 'HEIDY × CHIPS',  '22:00', 6),
      (v_event, 'DEMIC × AROS',   '22:30', 7),
      (v_event, 'DEMIC',          '23:00', 8),
      (v_event, 'AROS',           '23:30', 9);
  -- 라인업에 있는데 초대 코드가 없는 멤버를 채운다.
  -- 코드가 없으면 그 사람이 데려온 손님이 집계에서 빠진다
  insert into crew_members (crew_id, user_id, display_name, invite_code, role)
  select e.crew_id, null, x.nm, x.nm, 'member'
  from events e, (values ('CHIPS'), ('HEIDY'), ('DEMIC'), ('XANTHIC')) as x(nm)
  where e.id = v_event
  on conflict (crew_id, invite_code) do nothing;
end $ln$;

select display_name as 멤버, invite_code as 초대코드
from crew_members
where crew_id = (select crew_id from events where slug = 'after-sunset-20260829')
order by display_name;

select artist_name as 아티스트, to_char(starts_at, 'HH24:MI') as 시작
from lineups
where event_id = (select id from events where slug = 'after-sunset-20260829')
order by sort_order;
