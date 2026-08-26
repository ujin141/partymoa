-- ═══════════════════════════════════════════════════════════════════
--  이미 예매·입금한 42명을 명단에 올린다
--
--  ⬛ 아래 '?' 를 'F'(여) 또는 'M'(남) 으로 바꾸세요.
--
--  하나라도 '?' 로 남아 있으면 **아무것도 안 들어가고 멈춥니다.**
--  성별을 잘못 넣으면 그 성별이 먼저 마감돼서, 실제로는 자리가 있는데
--  예매가 막힙니다. 그래서 추측으로 채우지 않았습니다.
--
--  연락처는 비워 둡니다 — 현장 입장은 이름으로 찾습니다.
--  두 번 돌려도 같은 사람이 두 번 안 들어갑니다.
-- ═══════════════════════════════════════════════════════════════════

do $imp$
declare
  v_event uuid;
  v_tier  uuid;
  v_price int;
  r       record;
  n       int := 0;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다. SETUP.sql 을 먼저 돌리세요.';
  end if;

  -- 1차 얼리버드에 넣는다. 차수 정원이 모자라면 알려 준다
  select id into v_tier from ticket_tiers
  where event_id = v_event order by sort_order limit 1;
  if v_tier is null then
    raise exception '차수가 없습니다. 앞의 수리 SQL 을 먼저 돌리세요.';
  end if;

  for r in
    select * from (values
    ('선우윤아',                  '?')   --  1,
    ('박민지',                   '?')   --  2,
    ('이민재',                   '?')   --  3,
    ('박천준',                   '?')   --  4,
    ('이재현',                   '?')   --  5,
    ('윤승우',                   '?')   --  6,
    ('송문수',                   '?')   --  7,
    ('조민재',                   '?')   --  8,
    ('왕인혁',                   '?')   --  9,
    ('송혜정',                   '?')   -- 10,
    ('안주희',                   '?')   -- 11,
    ('홍지원',                   '?')   -- 12,
    ('이다인',                   '?')   -- 13,
    ('신연주',                   '?')   -- 14,
    ('김진수',                   '?')   -- 15,
    ('공지환',                   '?')   -- 16,
    ('원세현',                   '?')   -- 17,
    ('엄희락',                   '?')   -- 18,
    ('limanastasiyaolegovna', '?')   -- 19,
    ('skb',                   '?')   -- 20,
    ('최민경',                   '?')   -- 21,
    ('임사무엘',                  '?')   -- 22,
    ('조주안',                   '?')   -- 23,
    ('김민석',                   '?')   -- 24,
    ('이상원',                   '?')   -- 25,
    ('김종원',                   '?')   -- 26,
    ('신한빈',                   '?')   -- 27,
    ('정건희',                   '?')   -- 28,
    ('김태현',                   '?')   -- 29,
    ('유종원',                   '?')   -- 30,
    ('정주연',                   '?')   -- 31,
    ('박성수',                   '?')   -- 32,
    ('유혜준',                   '?')   -- 33,
    ('우상민',                   '?')   -- 34,
    ('성하늘',                   '?')   -- 35,
    ('장건우',                   '?')   -- 36,
    ('신윤정',                   '?')   -- 37,
    ('김태준',                   '?')   -- 38,
    ('최대성',                   '?')   -- 39,
    ('서교빈',                   '?')   -- 40,
    ('별',                     '?')   -- 41,
    ('정동윤',                   '?')   -- 42
    ) as t(nm, gd)
  loop
    if r.gd not in ('F', 'M') then
      raise exception '% 의 성별이 아직 ? 입니다. 전부 F 또는 M 으로 바꾸세요.', r.nm;
    end if;

    if exists (select 1 from bookings
               where event_id = v_event and name = r.nm and status <> 'cancelled') then
      continue;   -- 이미 올린 사람
    end if;

    -- 금액은 앱과 같은 규칙 — 차수가 여성 기준가, 남성은 계수를 곱해 천 원 반올림
    select round(
      case when r.gd = 'M' then t.price * e.male_price_multiplier
           else t.price::numeric end / 1000.0)::int * 1000
    into v_price
    from ticket_tiers t join events e on e.id = t.event_id where t.id = v_tier;

    insert into bookings (code, event_id, tier_id, user_id, name, phone, gender,
                          quantity, amount, invite_code, status, paid_at, expires_at)
    values ('PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
            v_event, v_tier, null, r.nm, '', r.gd,
            1, v_price, null, 'paid', now(), now() + interval '24 hours');
    n := n + 1;
  end loop;

  -- 1차 정원(40석)보다 많이 들어갈 수 있다. 이 사람들은 차수가 생기기 전에
  -- 예매했으니, 차수 쪽을 실제 인원에 맞춘다. 안 맞추면 판매량이 정원을
  -- 넘은 채로 남아 화면 숫자가 이상해진다
  update ticket_tiers t
  set capacity = greatest(t.capacity, (select sold from tier_stats s where s.tier_id = t.id))
  where t.id = v_tier;

  raise notice '%명 올렸습니다', n;
end $imp$;

select
  (select count(*) from bookings where status <> 'cancelled') as 예매건수,
  (select booked   from event_stats limit 1) as 예매인원,
  (select booked_f from event_stats limit 1) as 여성,
  (select booked_m from event_stats limit 1) as 남성,
  (select capacity from event_stats limit 1) as 정원,
  (select capacity - booked from event_stats limit 1) as 잔여,
  (select revenue_paid from event_stats limit 1) as 확정매출;
