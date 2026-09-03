-- 다음 파티 초안. **PERKS.sql 을 먼저 돌린 뒤** 이걸 돌린다.
--
-- status 는 draft 다 — **아무에게도 안 보인다.** 크루 화면에서 열어
-- 확인하고, 빠진 것을 채운 뒤에 직접 공개로 바꾸면 된다.
--
-- ## 정해진 것만 넣었다
--
-- 날짜(9/26 21:00)와 주소는 **자리만 잡아 둔 값**이다. 기획서에 미정으로
-- 적혀 있어서 지어내지 않고 고치기 쉬운 형태로만 뒀다. 특히 주소는
-- 비워 뒀다 — 틀린 주소가 적힌 파티는 안 적힌 파티보다 나쁘다.
--
-- 디제이 시간표도 안 넣었다. 시각이 정해져야 줄이 생긴다.

do $party$
declare
  v_crew  uuid;
  v_bank  text;
  v_event uuid;
  v_tier  uuid;
begin
  -- 크루와 계좌는 지난 파티 것을 그대로 쓴다. 계좌를 새로 치면 오타가 난다
  select crew_id, bank_account into v_crew, v_bank
  from events where slug = 'after-sunset-20260829';
  if v_crew is null then
    raise exception '지난 파티를 못 찾았습니다.';
  end if;

  select id into v_event from events where slug = 'after-moon-20260926';
  if v_event is not null then
    raise notice '이미 있습니다. 크루 화면에서 수정하세요.';
    return;
  end if;

  insert into events (
    crew_id, slug, title, subtitle, description,
    venue_name, area, starts_at, ends_at,
    capacity, gender_balanced,
    -- **남녀 같은 값을 받는다.** 기본값 1.25 를 그대로 두면 입장비를
    -- 1만원으로 넣어도 남자에게 12,500 원이 찍힌다
    male_price_multiplier,
    solo_friendly, genres, categories, list_price, guest_price,
    bank_account, status
  ) values (
    v_crew, 'after-moon-20260926', 'AFTER MOON',
    '한가위 라운지 · 압구정 딥하우즈',
    '해가 지고 달이 뜹니다. AFTER SUNSET 다음 밤.' || chr(10) || chr(10) ||
    '연휴 마지막 토요일, 서울에 남은 사람들끼리 압구정 딥하우즈 라운지에서 만납니다. 다음 날은 일요일이라 서두를 이유가 없어요.' || chr(10) || chr(10) ||
    '── 음악' || chr(10) ||
    'MELODIC HOUSE · DEEP HOUSE · TECH HOUSE · BASS HOUSE · TECHNO' || chr(10) || chr(10) ||
    '── 혼자 와도 됩니다' || chr(10) ||
    '테이블마다 게임을 깔아 둡니다. 모르는 사람끼리 앉아도 십 분이면 말이 트여요.' || chr(10) || chr(10) ||
    '── 한가위' || chr(10) ||
    '떡과 전, 전통주를 같이 놓습니다.',
    -- **장소를 아직 안 적는다.** 포스터·사이트에서 뺀 것과 같은 이유다 —
    -- 확정 전에 박아 두면 바뀌었을 때 이미 예매한 사람에게 딴 데를
    -- 알려 준 셈이 된다. 정해지면 크루 화면에서 채운다
    '곧 공개', '서울',
    -- 자리만 잡아 둔 시각. 정해지면 크루 화면에서 고친다
    timestamptz '2026-09-26 21:00+09',
    timestamptz '2026-09-27 03:00+09',
    30, true, 1,
    true,
    array['딥하우스', '하우스', '테크노'],
    array['라운지', '솔로파티'],
    9900,
    -- **게스트가를 안 둔다. 전원 1만원이다.**
    -- 비워 두면 추천인 코드가 값을 안 바꾸고 누가 데려왔는지만 남는다 --
    null,
    v_bank, 'draft'
  )
  returning id into v_event;

  -- 차수는 하나. 정원과 같은 수량이라야 정원을 다 판다
  insert into ticket_tiers (event_id, name, note, price, capacity, sort_order)
  values (v_event, '1차', '남녀 동일', 9900, 30, 0)
  returning id into v_tier;

  -- 베뉴가 호세 한 바틀을 준다. **원가 0원짜리 쿠폰이다**
  insert into event_perks (event_id, name, note, qty, per_person, sort_order)
  values (v_event, '웰컴 샷', '호세쿠엘보 1잔 · 바에서 보여 주세요', 1, true, 0);

  -- 디제이 코드. 값은 안 깎이고 **누가 데려왔는지만 센다.**
  -- 무페이라 나중에 뭘 챙겨 줄 근거가 필요한데, 그때 이 숫자가 근거다.
  --
  -- **user_id 를 비워 둔다** — 채우면 그 사람이 손님 명단과 연락처를
  -- 볼 수 있게 된다. 코드는 집계에만 쓰면 된다
  insert into crew_members (crew_id, display_name, invite_code)
  values (v_crew, 'ts (정훈)', 'TS'),
         (v_crew, 'aros (진혁)', 'AROS')
  on conflict (crew_id, invite_code) do nothing;

  raise notice 'AFTER MOON 초안 생성. 크루 화면에서 열어 보세요.';
end $party$;

-- ═══════════════════════════════════════════════════════════════════
--  공개하기
--
--  위까지는 초안(draft)이라 **아무에게도 안 보인다.** 크루 화면에서
--  주소·시간·커버를 채운 뒤에 아래 한 줄을 돌리면 팔리기 시작한다.
--
--  **누르는 순간 진짜 손님이 예매할 수 있다.** 심사용으로만 여는 게
--  아니다 — 앱 심사자도 이 파티를 보고, 지나가던 손님도 본다.
--
--  앱 심사(가이드라인 2.1a)에는 파는 파티가 반드시 하나 있어야 한다.
--  홈에 팔 게 없으면 심사자가 예매·티켓·쿠폰을 하나도 못 본다.
-- ═══════════════════════════════════════════════════════════════════

update events set status = 'open' where slug = 'after-moon-20260926';

-- ─────────────────────────────────────────── 확인
select title, status, capacity, list_price as 입장비,
       male_price_multiplier as 남성배수, guest_price as 게스트가,
       to_char(starts_at at time zone 'Asia/Seoul', 'MM/DD(Dy) HH24:MI') as 시작
from events where slug = 'after-moon-20260926';

select name, qty, per_person from event_perks p
join events e on e.id = p.event_id
where e.slug = 'after-moon-20260926';

select display_name, invite_code from crew_members
where invite_code in ('TS', 'AROS');
