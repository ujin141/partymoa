-- 차수마다 남성가를 따로 적는다.
--
-- 지금까지는 행사에 계수 하나(male_price_multiplier)만 있어서 남성가가
-- 여성가 × 계수로 정해졌다. 실제 크루는 그렇게 안 판다 — 1차는 39/49,
-- 3차는 59/69 처럼 **차수마다 두 가격을 따로 정한다.** 계수 하나로는
-- 59,000 × 1.25 = 74,000 이 나와서 실제 69,000 과 5,000원 어긋났다.
--
-- 비워 두면 예전처럼 계수를 쓴다. 기존 행사는 그대로 돈다.
alter table ticket_tiers add column if not exists male_price int
  check (male_price is null or male_price >= 0);

comment on column ticket_tiers.male_price is
  '남성 가격. 비우면 events.male_price_multiplier 로 계산한다';

-- 예매 금액은 서버가 정한다. 여기가 유일한 진짜 계산이고
-- lib/rules.ts 의 priceFor 는 화면에 보여주기 위한 사본이다
create or replace function tier_price(p_tier ticket_tiers, p_event events, p_gender text)
returns int language sql immutable as $$
  select case
    when p_gender <> 'M' then p_tier.price
    when p_tier.male_price is not null then p_tier.male_price
    else (round(p_tier.price * p_event.male_price_multiplier / 1000.0) * 1000)::int
  end;
$$;
