-- 테이블 손님을 명단에서 따로 보이게. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 왜 필요한가
--
-- 테이블을 잡은 손님은 입장비가 0 원이다. 그런데 지금 명단은 0 원이면
-- **무료입장**으로 분류한다 — 크루가 그냥 넣어 준 사람과 30만원짜리
-- 테이블을 잡은 손님이 문 앞에서 똑같이 보인다.
--
-- events 에 이미 테이블 메뉴(event_tables)가 있다. 예매를 그 메뉴에
-- 붙이면 구분도 되고 어느 테이블인지도 같이 보인다.
--
-- ## 돈은 여기 안 담는다
--
-- table_id 는 **표시용**이다. 테이블 매출은 정산의 수입 항목에 한 줄로
-- 넣는다(INCOME.sql). 한 테이블에 네 명이 앉으면 네 건 모두 table_id 를
-- 갖는데, 여기에 금액까지 담으면 30만원이 네 번 잡힌다.

alter table bookings add column if not exists table_id uuid
  references event_tables on delete set null;

create index if not exists bookings_table_idx on bookings (table_id);

comment on column bookings.table_id is
  '앉는 테이블. 표시용이고 금액은 안 담는다 — 한 테이블에 여럿이 앉는다';

-- ─────────────────────────────────────────── 세 분을 VIP 에 붙인다

do $tag$
declare
  v_event uuid;
  v_table uuid;
  v_id    uuid;
  v_hit   int;
  r       record;
  n       int := 0;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  select id into v_table from event_tables
  where event_id = v_event and name = 'VIP';
  if v_table is null then
    raise exception 'VIP 테이블이 없습니다. 파티 수정에서 먼저 만드세요.';
  end if;

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

    update bookings set table_id = v_table where id = v_id;
    n := n + 1;
  end loop;

  raise notice 'VIP 테이블로 표시한 건수: %', n;
end $tag$;

-- ─────────────────────────────────────────── 확인

select b.code as 예매번호, b.name as 이름, b.amount as 금액,
       t.name as 테이블, t.seats as 좌석,
       coalesce(b.invite_code, '—') as 추천인
from bookings b
join events e on e.id = b.event_id
left join event_tables t on t.id = b.table_id
where e.slug = 'after-sunset-20260829'
  and b.table_id is not null
order by b.name;
