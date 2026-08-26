-- 티켓 말고 들어온 돈. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 왜 필요한가
--
-- 테이블 판매가 생겼다. 30만원을 받았는데 입장비는 안 받는다.
-- 지금 정산은 **예매 금액 합계만** 매출로 잡으므로, 이 돈이 어디에도
-- 안 들어간다 — 정산에서 30만원이 통째로 빠진다.
--
-- 예매 금액에 얹는 방법도 있었지만 안 했다. 그러면
--   · 그 손님 한 명이 30만원짜리로 보이고
--   · 플랫폼 수수료 7% 가 테이블비에까지 붙는다
-- 수수료는 **티켓 금액** 기준이다(사양서 3-5). 테이블비는 티켓이 아니다.
--
-- 그래서 지출 표에 수입 쪽을 연다. 항목 하나에 부호만 붙이는 것이라
-- 표가 늘어나지 않는다.

alter table event_expenses add column if not exists kind text
  not null default 'expense';

do $$
begin
  alter table event_expenses add constraint event_expenses_kind_check
    check (kind in ('expense', 'income'));
exception when duplicate_object then null;
end $$;

comment on column event_expenses.kind is
  'expense = 정산에서 뺀다 · income = 더한다. 수수료는 티켓 매출에만 붙는다';

-- ─────────────────────────────────────────── 확인

select label, amount, kind from event_expenses
join events e on e.id = event_expenses.event_id
where e.slug = 'after-sunset-20260829'
order by sort_order;
