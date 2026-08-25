-- ═══════════════════════════════════════════════════════════
-- 첫 행사 데이터. ALL.sql 을 먼저 돌린 뒤 이걸 돌린다.
--
-- **계좌번호와 이메일은 여기 없다.** 저장소는 공개될 수 있으므로
-- 아래 ⬛ 표시한 자리를 직접 채워 넣고 실행할 것.
-- ═══════════════════════════════════════════════════════════

-- ── 1. 크루 대표 계정 ─────────────────────────────────────
-- 먼저 https://www.partymoa.com/crew/login 에서 그 이메일로 한 번
-- 로그인해 계정을 만든다. 아래는 그 계정을 크루 대표로 묶는 것이다.

do $init$
declare
  v_owner uuid;
  v_crew  uuid;
  v_event uuid;
begin
  -- ⬛ 크루 대표 이메일
  select id into v_owner from auth.users
  where lower(email) = lower('crew@example.com') limit 1;

  if v_owner is null then
    raise exception '그 이메일로 가입한 계정이 없습니다. /crew/login 에서 먼저 로그인하세요.';
  end if;

  -- ── 2. 크루 ─────────────────────────────────────────────
  insert into crews (slug, name, bio, instagram, owner_id)
  values ('blackout', 'BLACKOUT', '서울 기반 DJ 크루', 'blackout_crew', v_owner)
  returning id into v_crew;

  -- 멤버별 초대 코드. 크루 내부 정산 근거가 된다
  insert into crew_members (crew_id, user_id, display_name, invite_code, role) values
    (v_crew, v_owner, 'AROS', 'AROS', 'owner'),
    (v_crew, null,    'LYNN', 'LYNN', 'member'),
    (v_crew, null,    'TS',   'TS',   'member'),
    (v_crew, null,    'V',    'V',    'member');

  -- ── 3. 행사 ─────────────────────────────────────────────
  insert into events (
    crew_id, slug, title, subtitle, description, cover_url,
    venue_name, area, address, starts_at, ends_at, capacity,
    gender_balanced, male_price_multiplier, solo_friendly,
    genres, categories, list_price, bank_account, status
  ) values (
    v_crew,
    'after-sunset-20260829',
    'AFTER SUNSET 야외 풀파티',
    '해질녘부터 자정까지, 어나더 라운지 야외 풀장',
    E'해가 지는 시간에 시작합니다.\n\n낮에는 물, 밤에는 조명. 같은 공간이 두 번 바뀝니다.\n혼자 와도 됩니다 — 자리 잡아 드려요.',
    -- ⬛ 커버 이미지. 실제 행사 사진으로 바꿀 것
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=70',
    '어나더 루프탑 라운지', '양재', '서울 서초구 양재동',
    '2026-08-29 17:00+09', '2026-08-30 00:00+09',
    80,            -- 정원
    true,          -- 성비 조절 (남녀 각 40)
    1.25,          -- 남성가 = 여성가 × 1.25
    true,          -- 1인 참여 환영
    '{"하우스","테크노"}', '{"풀파티","루프탑"}',
    59000,         -- 정가 (할인율 계산 기준)
    -- ⬛ 입금 계좌
    '은행 000-0000-0000-00 (예금주)',
    'draft'        -- 확인 끝나면 크루 화면에서 '예매 중' 으로 바꾼다
  ) returning id into v_event;

  -- ── 4. 차수 ─────────────────────────────────────────────
  -- 가격은 여성 기준가. 수량 합이 정원보다 적으면 정원을 다 못 판다
  insert into ticket_tiers (event_id, name, note, price, capacity, sort_order) values
    (v_event, '1차 얼리버드', '선착순 40명', 39000, 40, 0),
    (v_event, '2차 사전예매', null,          49000, 30, 1),
    (v_event, '3차 사전예매', '마지막 차수',  59000, 10, 2);

  -- ── 5. 라인업 ───────────────────────────────────────────
  insert into lineups (event_id, artist_name, starts_at, sort_order) values
    (v_event, 'AROS', '17:00', 0),
    (v_event, 'LYNN', '18:30', 1),
    (v_event, 'TS',   '20:00', 2),
    (v_event, 'V',    '21:30', 3);

  -- ── 6. 운영자 ───────────────────────────────────────────
  -- /admin 에 들어갈 사람. 크루 대표와 같아도 된다
  insert into app_admins (user_id, note) values (v_owner, '초기 운영자')
  on conflict (user_id) do nothing;

  raise notice '완료. 크루 %, 행사 %', v_crew, v_event;
end $init$;

-- ── 확인 ──────────────────────────────────────────────────
select e.title, e.status, e.capacity, e.bank_account,
       (select count(*) from ticket_tiers t where t.event_id = e.id) as 차수,
       (select count(*) from lineups l where l.event_id = e.id) as 라인업
from events e;
