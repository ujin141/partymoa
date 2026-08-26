-- 성별을 잘못 받은 예매를 고친다. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- 성별은 **성비 정원에 그대로 들어간다.** 한 건이 틀어져 있으면 남녀
-- 잔여가 한 자리씩 어긋나고, 마감 판단도 같이 틀어진다.
--
-- 금액은 안 건드린다. 게스트는 성별과 무관하게 게스트가고, 일반 예매를
-- 고쳐서 남녀 가격이 달라져야 하면 명단에서 [추천인] 을 눌러 다시
-- 계산시키거나 GUEST_EDIT.sql 로 금액을 직접 적는다.

do $g$
declare
  v_event uuid;
  v_id    uuid;
  v_hit   int;
  v_was   text;
  r       record;
  n       int := 0;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  for r in
    select * from (values
      -- 이름(또는 예매번호), 맞는 성별
      ('이다인', 'M')
    ) as t(who, gender)
  loop
    if r.gender not in ('F', 'M') then
      raise exception '성별은 F 나 M 이어야 합니다: %', r.gender;
    end if;

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

    select b.id, b.gender into v_id, v_was
    from bookings b
    where b.event_id = v_event
      and b.status <> 'cancelled'
      and (upper(b.code) = upper(r.who) or b.name = r.who);

    if v_was = r.gender then
      raise notice '이미 % 입니다: %', r.gender, r.who;
      continue;
    end if;

    update bookings set gender = r.gender where id = v_id;
    raise notice '% : % → %', r.who, v_was, r.gender;
    n := n + 1;
  end loop;

  raise notice '고친 건수: %', n;
end $g$;

-- ─────────────────────────────────────────── 확인
--
-- 성비가 정원을 넘지 않는지 본다. 넘었으면 그 성별 예매가 닫히는데,
-- **이미 받은 예매를 되돌리지는 않는다** — 넘은 채로 두고 크루가 판단한다.

select e.capacity as 정원,
       floor(e.capacity / 2.0)::int as 성별정원,
       s.booked_f as 여성, s.booked_m as 남성,
       floor(e.capacity / 2.0)::int - s.booked_f as 여성잔여,
       floor(e.capacity / 2.0)::int - s.booked_m as 남성잔여
from event_stats s
join events e on e.id = s.event_id
where e.slug = 'after-sunset-20260829';

select b.code as 예매번호, b.name as 이름,
       case b.gender when 'F' then '여' else '남' end as 성별,
       b.amount as 금액, coalesce(b.invite_code, '—') as 추천인
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.name = '이다인';
