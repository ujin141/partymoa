-- ═══════════════════════════════════════════════════════════════════
--  AFTER MOON 에 매장 사진 3장을 붙인다
--
--  **AFTER_MOON.sql 을 먼저 돌린 뒤** 이걸 돌린다. 행사가 없으면 멈춘다.
--
--  사진은 저장소에 들어 있다 — public/photos/after-moon/1~3.jpg.
--  AFTER SUNSET 과 같은 방식이다. 864×1080, 상세 페이지 띠가 4:5 라
--  원본(가로)을 가운데로 잘라 뒀다.
--
--    1  매장 전경. 간판 셋과 바
--    2  테이블 쪽. 창밖 거리까지
--    3  칵테일 두 잔
--
--  종류는 promo 다. 그날 찍은 기록이 아니라 미리 보여 주는 컷이다.
--  파티가 끝나고 기록을 올릴 때 이 셋은 앞에 안 선다.
--
--  두 번 돌려도 안전하다. 이 경로의 사진만 지우고 다시 넣는다.
-- ═══════════════════════════════════════════════════════════════════

do $ph$
declare
  v_event uuid;
  i int;
begin
  select id into v_event from events where slug = 'after-moon-20260926';
  if v_event is null then
    raise exception 'AFTER MOON 이 없습니다. AFTER_MOON.sql 을 먼저 돌리세요.';
  end if;

  delete from event_photos
  where event_id = v_event and url like '/photos/after-moon/%';

  for i in 1..3 loop
    insert into event_photos (event_id, url, caption, sort_order, kind)
    values (v_event, '/photos/after-moon/' || i || '.jpg', null, i, 'promo');
  end loop;

  -- 커버가 비어 있으면 전경을 쓴다. 홈 카드에 그림이 없는 파티는
  -- 눌러 보지도 않는다. 이미 넣어 둔 커버는 건드리지 않는다
  update events set cover_url = '/photos/after-moon/1.jpg'
  where id = v_event and cover_url is null;

  -- ── 장소 ──
  --
  -- 간판이 찍힌 사진을 올리는 순간 장소는 공개다. 사진에는 dip houz 가
  -- 보이는데 장소 칸에 '곧 공개' 가 남아 있으면 그게 더 이상하다.
  -- 손으로 이미 바꿔 뒀으면 안 건드린다
  update events
  set venue_name = '압구정 딥하우즈', area = '압구정'
  where id = v_event and venue_name = '곧 공개';

  -- ── 소개 글 ──
  --
  -- AFTER_MOON.sql 에 처음 적었던 글이 포스터에서 뺀 말들을 그대로
  -- 갖고 있었다. '한가위 라운지', '떡과 전, 전통주', 그리고 CHIPS 가
  -- 나가면서 라인업에서 사라진 MELODIC · DEEP. 포스터와 다른 말을
  -- 하면 안 되니 여기서 맞춘다
  update events
  set subtitle = '추석 연휴 마지막 토요일 · 압구정 딥하우즈',
      genres = array['테크하우스', '베이스하우스', '테크노'],
      description =
        '추석 연휴 마지막 토요일. 압구정 딥하우즈에서 22시부터 새벽 2시 10분까지.'
        || chr(10) || chr(10) ||
        '── 음악' || chr(10) ||
        'TECH HOUSE · BASS HOUSE · TECHNO' || chr(10) ||
        'BHO · LYNN · LII · AROS · TS' || chr(10) || chr(10) ||
        '── 혼자 와도 됩니다' || chr(10) ||
        '테이블마다 게임을 깔아 둡니다. 지난 파티는 50명 중 48명이 혼자 왔습니다.'
        || chr(10) || chr(10) ||
        '── 입장' || chr(10) ||
        '9,900원, 남녀 같은 값. 웰컴샷 한 잔 포함.' || chr(10) ||
        '1차 30명, 남녀 15명씩. 한쪽이 차면 그쪽부터 닫힙니다.'
  where id = v_event;

  raise notice '사진 3장 · 커버 · 장소 · 소개';
end $ph$;

-- ─────────────────────────────────────────── 확인

select title, venue_name, area, cover_url, subtitle
from events where slug = 'after-moon-20260926';

select p.sort_order, p.kind, p.url
from event_photos p
join events e on e.id = p.event_id
where e.slug = 'after-moon-20260926'
order by p.sort_order;
