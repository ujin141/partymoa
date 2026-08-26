-- ═══════════════════════════════════════════════════════════════════
--  AFTER SUNSET — 실제 행사 정보로 맞춘다
--
--  IMPORT_GUESTS.sql 을 먼저 돌리세요. 42명이 들어가 있어야
--  차수 마감 계산이 맞습니다.
--
--  바뀌는 것
--   · 오픈 19:00 ~ 24:00  (기존 17:00 → 19:00. 첫 DJ 가 TS 19:00)
--   · 장소 · 애프터파티 · 협업 브랜드 · 인스타 계정을 소개글에 넣는다
--   · 입금 계좌
--   · **3차 남 69,000 / 여 59,000** — 차수별 남성가를 따로 적는다
--   · 1차 · 2차를 판매량에 맞춰 닫고, 남은 정원을 3차로 넘긴다
--   · 예매 오픈(status = open)
-- ═══════════════════════════════════════════════════════════════════

-- 차수별 남성가 컬럼. SETUP.sql 을 다시 안 돌려도 되게 여기서도 넣는다
alter table ticket_tiers add column if not exists male_price int;
do $$ begin
  alter table ticket_tiers add constraint ticket_tiers_male_price_check
    check (male_price is null or male_price >= 0);
exception when duplicate_object then null;
end $$;

create or replace function tier_price(p_tier ticket_tiers, p_event events, p_gender text)
returns int language sql immutable as $$
  select case
    when p_gender <> 'M' then p_tier.price
    when p_tier.male_price is not null then p_tier.male_price
    else (round(p_tier.price * p_event.male_price_multiplier / 1000.0) * 1000)::int
  end;
$$;

-- 크루 로고. 홈의 동그란 크루 칸이 지금은 'BL' 두 글자만 뜬다
update crews set avatar_url = '/crews/blackout.png'
where slug = 'blackout' and coalesce(avatar_url, '') = '';

do $ev$
declare
  v_event uuid;
  v_sold  int;
  v_left  int;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다. SETUP.sql 을 먼저 돌리세요.';
  end if;

  -- title 은 건드리지 않는다. 지금 'AFTER SUNSET 야외 풀파티' 로 올라가
  -- 있고 포스터·OG 카드가 그 이름으로 나갔다.
  -- description 은 우진이 보낸 문구 그대로 넣는다
  update events set
    subtitle    = 'Pool Party & Solo Party',
    venue_name  = '어나더 루프탑 라운지',
    area        = '양재',
    address     = '서울 서초구 양재동 122-6 어나더 루프탑 라운지 5층',
    -- 시간은 우진이 준 값 그대로. 19시 오픈 · 자정 종료
    starts_at   = timestamptz '2026-08-29 19:00+09',
    ends_at     = timestamptz '2026-08-30 00:00+09',
    bank_account = '농협 352-0860-4459-03 (송우진)',
    solo_friendly = true,
    status      = 'open',
    description = concat_ws(E'\n',
      '답답한 도심을 벗어나 시원한 물속에서 즐기는 특별한 여름 밤.',
      '혼자 와도 전혀 어색하지 않은 자유롭고 스타일리시한 풀 파티.',
      '',
      '트렌디한 DJ 라이브 비트, 청량한 시그니처 칵테일,',
      '그리고 새로운 인연과의 자연스러운 교류까지.',
      '',
      '── 장소',
      '1  어나더 루프탑 라운지 5층 · 서울 서초구 양재동 122-6',
      '2  AFTER PARTY : ACE SPACE ZONE · 서울 서초구 잠원동 21-3',
      '',
      '── 시간',
      'PM 19:00 OPEN — AM 12:00 CLOSE',
      '',
      '── 함께 여는 곳',
      'ACE CLUB × SPACE CLUB × ANOTHER LOUNGE × BLACK CREW × ZSPOT LOUNGE',
      '',
      '── 인스타그램',
      '@blackoutcrew_official',
      '@another.lounge',
      '@clubaceseoul_official',
      '@ace_hiphopzone',
      '@zspot_lounge'
    )
  where id = v_event;

  -- ── 1차 · 2차를 판매량에 맞춰 닫는다.
  --    정원이 남아 있으면 앱이 지난 차수를 싼값에 계속 판다
  update ticket_tiers t
  set capacity = greatest(1, (select sold from tier_stats s where s.tier_id = t.id))
  where t.event_id = v_event and t.sort_order in (0, 1)
    and (select sold from tier_stats s where s.tier_id = t.id) > 0;

  -- ── 3차. 남은 정원을 전부 준다
  select coalesce(sum(capacity), 0) into v_sold
  from ticket_tiers where event_id = v_event and sort_order in (0, 1);
  select capacity into v_left from events where id = v_event;
  v_left := greatest(1, v_left - v_sold);

  update ticket_tiers set
    name       = '3차 사전예매',
    note       = '사전 예약제',
    price      = 59000,   -- 여성
    male_price = 69000,   -- 남성. 계수(1.25)로는 74,000 이 나와서 안 맞는다
    capacity   = v_left
  where event_id = v_event and sort_order = 2;

  raise notice '3차 정원 %장', v_left;
end $ev$;

select title as 행사,
       to_char(starts_at at time zone 'Asia/Seoul', 'MM/DD(Dy) HH24:MI') as 시작,
       to_char(ends_at   at time zone 'Asia/Seoul', 'HH24:MI') as 종료,
       venue_name as 장소, status as 상태, bank_account as 계좌
from events where slug = 'after-sunset-20260829';

select t.name as 차수, t.price as 여성가,
       coalesce(t.male_price, (round(t.price * e.male_price_multiplier / 1000.0) * 1000)::int) as 남성가,
       s.sold as 판매, t.capacity as 정원, t.capacity - s.sold as 남은장수
from ticket_tiers t
join events e on e.id = t.event_id
join tier_stats s on s.tier_id = t.id
where e.slug = 'after-sunset-20260829'
order by t.sort_order;
