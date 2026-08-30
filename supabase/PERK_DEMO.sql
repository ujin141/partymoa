-- 쿠폰 디자인 확인용. **PERKS.sql 을 먼저 돌린 뒤** 이걸 돌린다.
--
-- ujin141@naver.com 계정에 쓸 수 있는 쿠폰 두 장을 넣는다.
--
-- ## 왜 가짜 파티를 하나 만드나
--
-- AFTER SUNSET 에 붙이면 이미 끝난 파티라 쿠폰이 "기간 지남" 회색으로
-- 뜬다. 디자인을 보려는 건데 죽은 상태만 보게 된다. 그래서 **지금
-- 열려 있는 파티**를 하나 만들어 거기 붙인다.
--
-- 이 파티는 status 를 closed 로 둔다 — 홈·둘러보기는 open 만 싣고
-- 지난 파티는 done 만 실으므로 **어디에도 안 뜬다.** 주소를 직접 쳐야
-- 보인다. 정원 통계도 진짜 행사와 안 섞인다.
--
-- ## 다 보고 나면
--
-- 맨 아래 지우기 블록의 주석을 풀고 그것만 실행하면 흔적 없이 사라진다.

do $demo$
declare
  v_user  uuid;
  v_crew  uuid;
  v_event uuid;
  v_tier  uuid;
  v_book  uuid;
begin
  select id into v_user from auth.users where email = 'ujin141@naver.com';
  if v_user is null then
    raise exception '그 이메일로 가입한 계정이 없습니다. 앱에서 한 번 로그인한 뒤 다시 돌려 주세요.';
  end if;

  -- 크루는 기존 것을 그대로 쓴다. 새로 만들면 크루 목록이 지저분해진다
  select crew_id into v_crew from events order by starts_at desc limit 1;
  if v_crew is null then
    raise exception '크루가 없습니다.';
  end if;

  select id into v_event from events where slug = 'coupon-demo';

  if v_event is null then
    insert into events (
      crew_id, slug, title, subtitle, venue_name, area,
      starts_at, ends_at, capacity, list_price, status, solo_friendly
    ) values (
      v_crew, 'coupon-demo', '쿠폰 미리보기', '디자인 확인용 · 목록에 안 뜹니다',
      '어나더 루프탑 라운지', '서울',
      -- 지금 열려 있는 파티로 둔다. 그래야 "사용 가능" 상태가 보인다
      now() - interval '1 hour', now() + interval '8 hours',
      80, 30000, 'closed', true
    )
    returning id into v_event;
  else
    -- 두 번째로 돌릴 때. 시간만 지금으로 당겨 준다
    update events
    set starts_at = now() - interval '1 hour',
        ends_at = now() + interval '8 hours'
    where id = v_event;
  end if;

  select id into v_tier from ticket_tiers where event_id = v_event limit 1;
  if v_tier is null then
    insert into ticket_tiers (event_id, name, price, capacity, sort_order)
    values (v_event, '1차', 30000, 80, 0)
    returning id into v_tier;
  end if;

  -- **쿠폰 정의를 예매보다 먼저 넣는다.** 트리거가 예매 저장 순간에
  -- 발급하기 때문에, 순서가 뒤집히면 줄 게 없어서 아무것도 안 나간다
  delete from event_perks where event_id = v_event;
  insert into event_perks (event_id, name, note, qty, per_person, sort_order)
  values
    (v_event, '웰컴 드링크',
     '시그니처 칵테일 1잔 · 바에서 보여 주세요', 1, true, 0),
    (v_event, '락커 + 방수 밴드',
     '입구 데스크에서 받으세요', 1, false, 1);

  select id into v_book from bookings
  where event_id = v_event and user_id = v_user limit 1;

  if v_book is null then
    insert into bookings (
      code, event_id, tier_id, user_id, name, phone, gender,
      quantity, amount, status, paid_at, expires_at
    ) values (
      'PMDEMO', v_event, v_tier, v_user, '우진', '010-0000-0000', 'M',
      -- 4명으로 넣는다. **한 장에 넉 잔**이 담기는 모양을 봐야 한다
      4, 120000, 'paid', now(), now() + interval '1 day'
    )
    returning id into v_book;
  else
    update bookings set status = 'paid', paid_at = now() where id = v_book;
  end if;

  perform issue_perks(v_book);

  raise notice '완료. 앱에서 내 티켓 → 쿠폰 탭을 보세요.';
end $demo$;

-- ─────────────────────────────────────────── 확인
select p.name, bp.total as 나간장수, bp.used as 쓴장수
from booking_perks bp
join event_perks p on p.id = bp.perk_id
join events e on e.id = p.event_id
where e.slug = 'coupon-demo';

-- ─────────────────────────────────────────── 지우기
--
-- 다 보고 나면 아래 두 줄의 주석을 풀고 그것만 실행한다.
-- 파티를 지우면 예매도 쿠폰도 따라 지워진다.
--
-- delete from events where slug = 'coupon-demo';
-- select count(*) as 남은것 from events where slug = 'coupon-demo';
