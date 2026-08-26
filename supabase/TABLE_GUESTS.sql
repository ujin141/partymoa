-- 테이블 손님. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- 김진수 · 김태준 · 최대성 세 분이 30만원짜리 테이블을 잡았습니다.
-- **입장비는 안 받습니다.** 지금 명단에 30,000 원으로 들어가 있는 걸
-- 0 원으로 내리고, 테이블비 30만원은 정산에 따로 얹습니다.
--
-- 예매 금액에 30만원을 얹지 않는 이유는 두 가지입니다.
--   · 그 손님 한 명이 30만원짜리로 보인다
--   · 플랫폼 수수료가 테이블비에까지 붙는다 (수수료는 티켓 금액 기준)
--
-- **INCOME.sql 을 먼저 돌리는 게 좋습니다.** 안 돌렸어도 아래가
-- 알아서 판단하지만, 그러면 테이블비가 수입이 아니라 지출로 잡혀
-- 정산액이 60만원 어긋납니다.

do $tbl$
declare
  v_event uuid;
  v_id    uuid;
  v_hit   int;
  v_has_kind boolean;
  r       record;
  n       int := 0;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  -- ── 1. 세 분 입장비를 0 으로 ────────────────────────
  --
  -- 추천인은 **건드리지 않습니다.** 송우진이 크루 멤버로 등록돼 있든
  -- 아니든, 이미 적혀 있는 값을 그대로 둡니다.
  for r in
    select * from (values ('김진수'), ('김태준'), ('최대성')) as t(who)
  loop
    select count(*) into v_hit
    from bookings b
    where b.event_id = v_event
      and b.status <> 'cancelled'
      and (upper(b.code) = upper(r.who) or b.name = r.who);

    if v_hit = 0 then
      raise exception '"%" 을 명단에서 못 찾았습니다.', r.who;
    end if;
    if v_hit > 1 then
      raise exception '"%" 이 %건입니다. 이름 대신 예매번호로 적으세요.',
        r.who, v_hit;
    end if;

    select b.id into v_id
    from bookings b
    where b.event_id = v_event
      and b.status <> 'cancelled'
      and (upper(b.code) = upper(r.who) or b.name = r.who);

    update bookings set amount = 0 where id = v_id;
    n := n + 1;
  end loop;

  raise notice '입장비 0 원으로 바꾼 건수: %', n;

  -- ── 2. 테이블비 30만원을 정산에 ─────────────────────
  select exists (
    select 1 from information_schema.columns
    where table_name = 'event_expenses' and column_name = 'kind'
  ) into v_has_kind;

  if not v_has_kind then
    raise exception 'INCOME.sql 을 먼저 실행하세요. '
      '수입 칸이 없어서 테이블비가 지출로 잡힙니다.';
  end if;

  -- 두 번 돌려도 안 겹치게
  if exists (
    select 1 from event_expenses
    where event_id = v_event and label = '테이블 (김진수 외 2인)'
  ) then
    raise notice '테이블비는 이미 들어가 있습니다.';
  else
    insert into event_expenses (event_id, label, amount, kind, sort_order)
    values (v_event, '테이블 (김진수 외 2인)', 300000, 'income', 10);
    raise notice '테이블비 300,000 원을 수입으로 넣었습니다.';
  end if;
end $tbl$;

-- ─────────────────────────────────────────── 확인

select b.code as 예매번호, b.name as 이름, b.amount as 금액,
       coalesce(b.invite_code, '—') as 추천인, b.status as 상태
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.name in ('김진수', '김태준', '최대성')
order by b.name;

select label as 항목, amount as 금액, kind as 구분
from event_expenses x
join events e on e.id = x.event_id
where e.slug = 'after-sunset-20260829'
order by x.sort_order;
