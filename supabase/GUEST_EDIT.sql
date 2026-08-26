-- ═══════════════════════════════════════════════════════════════════
--  이미 명단에 있는 사람의 추천인·금액을 고친다
--
--  GUEST_ADD 는 없는 사람을 넣는 파일이고, 이건 **이미 들어와 있는
--  사람**을 고치는 파일입니다. 연락처는 건드리지 않습니다.
--
--    이름 · 초대한 DJ · 금액
--
--  DJ 이름은 crew_members.display_name 을 그대로 씁니다(LYNN, AROS…).
--  없으면 아무것도 안 고치고 멈춥니다.
--
--  **같은 이름이 둘이면 멈춥니다.** 누구를 고치는지 모르는 채로
--  금액을 바꾸는 게 제일 나쁩니다. 그럴 땐 아래 확인용 select 로
--  예매번호를 찾아 이름 자리에 예매번호(PM0042)를 적으세요.
-- ═══════════════════════════════════════════════════════════════════

do $edit$
declare
  v_event uuid;
  v_code  text;
  v_id    uuid;
  v_hit   int;
  r       record;
  n       int := 0;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  for r in
    select * from (values
      -- 이름(또는 예매번호), 초대 DJ, 금액
      -- 이영연 · 3차 59,000 으로 입금 완료된 건 → LYNN 게스트가 30,000
      ('PM0048', 'LYNN', 30000)
    ) as t(who, dj, amount)
  loop
    -- 초대 코드를 DJ 이름으로 찾는다. 없으면 멈춘다
    v_code := null;
    if r.dj is not null then
      select m.invite_code into v_code
      from crew_members m
      join events e on e.crew_id = m.crew_id
      where e.id = v_event and upper(m.display_name) = upper(r.dj);

      if v_code is null then
        raise exception '초대 DJ "%" 를 크루 멤버에서 못 찾았습니다. '
          '크루 관리에서 코드를 먼저 만드세요.', r.dj;
      end if;
    end if;

    -- 예매번호로 왔으면 그걸로, 아니면 이름으로 찾는다.
    -- **세는 것과 고르는 것을 나눈다** — min() 은 uuid 를 못 받는다
    select count(*) into v_hit
    from bookings b
    where b.event_id = v_event
      and b.status <> 'cancelled'
      and (upper(b.code) = upper(r.who) or b.name = r.who);

    if v_hit = 0 then
      raise exception '"%" 을 명단에서 못 찾았습니다.', r.who;
    end if;
    if v_hit > 1 then
      raise exception '"%" 이 %건입니다. 예매번호로 지정하세요.', r.who, v_hit;
    end if;

    select b.id into v_id
    from bookings b
    where b.event_id = v_event
      and b.status <> 'cancelled'
      and (upper(b.code) = upper(r.who) or b.name = r.who);

    update bookings
       set invite_code = v_code,
           amount = r.amount
     where id = v_id;

    n := n + 1;
  end loop;

  raise notice '고친 건수: %', n;
end $edit$;

-- ─────────────────────────────────────────── 확인

select b.code as 예매번호,
       b.name as 이름,
       b.phone as 연락처,
       case b.gender when 'F' then '여' else '남' end as 성별,
       b.quantity as 인원,
       b.amount as 금액,
       coalesce(b.invite_code, '—') as 초대,
       b.status as 상태
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.status <> 'cancelled'
order by b.created_at desc
limit 20;
