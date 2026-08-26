-- ═══════════════════════════════════════════════════════════════════
--  이미 예매·입금한 42명을 명단에 올린다   (1차 20 · 2차 22)
--
--  ⬛ 아래 '?' 를 'F'(여) 또는 'M'(남) 으로 바꾸세요.
--
--  하나라도 '?' 로 남아 있으면 **아무것도 안 들어가고 멈춥니다.**
--  성별을 잘못 넣으면 그 성별이 먼저 마감돼서, 실제로는 자리가 있는데
--  예매가 막힙니다. 그래서 추측으로 채우지 않았습니다.
--
--  맨 끝 숫자는 차수입니다. 앞 20명을 1차, 뒤 22명을 2차로 뒀습니다.
--  순서가 다르면 그 숫자만 바꾸세요 — 금액이 따라 바뀝니다.
--
--  연락처는 비워 둡니다. 현장 입장은 이름으로 찾습니다.
--  같은 이름은 건너뛰니 두 번 돌려도 안 겹칩니다.
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

  if (select count(*) from ticket_tiers where event_id = v_event) < 2 then
    raise exception '차수가 2개 미만입니다. SETUP.sql 을 먼저 돌리세요.';
  end if;

  for r in
    select * from (values
    ('선우윤아',                  '?', 1)   --  1,
    ('박민지',                   '?', 1)   --  2,
    ('이민재',                   '?', 1)   --  3,
    ('박천준',                   '?', 1)   --  4,
    ('이재현',                   '?', 1)   --  5,
    ('윤승우',                   '?', 1)   --  6,
    ('송문수',                   '?', 1)   --  7,
    ('조민재',                   '?', 1)   --  8,
    ('왕인혁',                   '?', 1)   --  9,
    ('송혜정',                   '?', 1)   -- 10,
    ('안주희',                   '?', 1)   -- 11,
    ('홍지원',                   '?', 1)   -- 12,
    ('이다인',                   '?', 1)   -- 13,
    ('신연주',                   '?', 1)   -- 14,
    ('김진수',                   '?', 1)   -- 15,
    ('공지환',                   '?', 1)   -- 16,
    ('원세현',                   '?', 1)   -- 17,
    ('엄희락',                   '?', 1)   -- 18,
    ('limanastasiyaolegovna', '?', 1)   -- 19,
    ('skb',                   '?', 1)   -- 20,
    ('최민경',                   '?', 2)   -- 21,
    ('임사무엘',                  '?', 2)   -- 22,
    ('조주안',                   '?', 2)   -- 23,
    ('김민석',                   '?', 2)   -- 24,
    ('이상원',                   '?', 2)   -- 25,
    ('김종원',                   '?', 2)   -- 26,
    ('신한빈',                   '?', 2)   -- 27,
    ('정건희',                   '?', 2)   -- 28,
    ('김태현',                   '?', 2)   -- 29,
    ('유종원',                   '?', 2)   -- 30,
    ('정주연',                   '?', 2)   -- 31,
    ('박성수',                   '?', 2)   -- 32,
    ('유혜준',                   '?', 2)   -- 33,
    ('우상민',                   '?', 2)   -- 34,
    ('성하늘',                   '?', 2)   -- 35,
    ('장건우',                   '?', 2)   -- 36,
    ('신윤정',                   '?', 2)   -- 37,
    ('김태준',                   '?', 2)   -- 38,
    ('최대성',                   '?', 2)   -- 39,
    ('서교빈',                   '?', 2)   -- 40,
    ('별',                     '?', 2)   -- 41,
    ('정동윤',                   '?', 2)   -- 42
    ) as t(nm, gd, tr)
  loop
    if r.gd not in ('F', 'M') then
      raise exception '% 의 성별이 아직 ? 입니다. 전부 F 또는 M 으로 바꾸세요.', r.nm;
    end if;

    if exists (select 1 from bookings
               where event_id = v_event and name = r.nm and status <> 'cancelled') then
      continue;
    end if;

    select id into v_tier from ticket_tiers
    where event_id = v_event order by sort_order offset (r.tr - 1) limit 1;

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

  -- **1차를 마감시킨다.** 20장에서 끝났는데 정원이 40으로 남아 있으면
  -- 앱이 1차를 39,000원에 또 판다. 판매량에 맞춰 닫는다
  update ticket_tiers t
  set capacity = (select sold from tier_stats s where s.tier_id = t.id)
  where t.event_id = v_event and t.sort_order = 0
    and (select sold from tier_stats s where s.tier_id = t.id) > 0;

  raise notice '%명 올렸습니다', n;
end $imp$;

select
  (select count(*) from bookings where status <> 'cancelled') as 예매건수,
  (select booked   from event_stats limit 1) as 예매인원,
  (select booked_f from event_stats limit 1) as 여성,
  (select booked_m from event_stats limit 1) as 남성,
  (select capacity - booked from event_stats limit 1) as 잔여,
  (select revenue_paid from event_stats limit 1) as 확정매출;

-- 차수별로 얼마나 팔렸고 몇 장 남았는지
select t.name as 차수, t.price as 여성가, s.sold as 판매, t.capacity as 정원,
       t.capacity - s.sold as 남은장수
from ticket_tiers t join tier_stats s on s.tier_id = t.id
order by t.sort_order;

-- 앞으로 더 팔 수 있는 장수가 정원에 못 미치면 여기서 드러난다
select (select capacity from events where slug='after-sunset-20260829') as 행사정원,
       (select booked from event_stats limit 1)
         + (select coalesce(sum(t.capacity - s.sold), 0)
            from ticket_tiers t join tier_stats s on s.tier_id = t.id) as 최대판매가능;
