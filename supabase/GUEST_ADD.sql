-- ═══════════════════════════════════════════════════════════════════
--  손으로 받은 예매를 명단에 올린다
--
--  DM 이나 현장에서 받은 건을 앱 명단에 넣는 파일입니다. **매번
--  아래 표만 갈아 끼우면 됩니다.**
--
--    이름 · 연락처 · 성별(F/M) · 금액 · 초대한 DJ · 입금 여부
--
--  초대한 DJ 는 crew_members.display_name 을 그대로 씁니다(LYNN,
--  AROS…). 그 이름이 없으면 **아무것도 안 넣고 멈춥니다** — 오타로
--  집계가 엉뚱한 데 붙는 게 제일 나쁩니다. 초대가 없으면 null.
--
--  같은 이름 + 같은 연락처가 이미 있으면 건너뜁니다. 두 번 돌려도
--  안 겹칩니다.
--
--  ** 실제 번호를 이 파일에 적어 두지 마세요. ** 이 저장소는 공개입니다.
--  번호는 Supabase SQL 편집기에서 붙여 넣고 돌린 뒤, 파일은 그대로
--  두세요. 자리만 잡아 둔 010-0000-0000 은 일부러 멈추게 해놨습니다.
-- ═══════════════════════════════════════════════════════════════════

do $add$
declare
  v_event uuid;
  v_tier  uuid;
  v_code  text;
  r       record;
  n       int := 0;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  -- 지금 열려 있는 마지막 차수. 게스트가는 아래 표에서 직접 적으므로
  -- 차수는 자리 계산에만 쓰입니다
  select id into v_tier from ticket_tiers
  where event_id = v_event order by sort_order desc limit 1;

  for r in
    select * from (values
      -- 이름,      연락처,           성별, 금액,  초대 DJ,  입금
      ('김서연',    '010-0000-0000',  'F', 30000, 'LYNN',  true)
    ) as t(name, phone, gender, amount, dj, paid)
  loop
    -- **연락처를 안 채우고 돌리면 멈춘다.** 명단 검색도 미입금 독촉도
    -- 전부 번호로 도는데, 자리만 채운 번호가 섞이면 그때부터 못 쓴다
    if regexp_replace(r.phone, '\D', '', 'g') in ('01000000000', '') then
      raise exception '연락처를 실제 번호로 바꾸고 다시 돌리세요: %', r.name;
    end if;

    -- 초대 코드를 이름으로 찾는다. 없으면 멈춘다
    v_code := null;
    if r.dj is not null then
      select m.invite_code into v_code
      from crew_members m
      join crews c on c.id = m.crew_id
      join events e on e.crew_id = c.id
      where e.id = v_event and upper(m.display_name) = upper(r.dj);

      if v_code is null then
        raise exception '초대 DJ "%" 를 크루 멤버에서 못 찾았습니다. '
          '이름을 확인하거나 크루 현황에서 코드를 먼저 만드세요.', r.dj;
      end if;
    end if;

    -- 이미 있으면 건너뛴다
    if exists (
      select 1 from bookings b
      where b.event_id = v_event
        and b.name = r.name
        and regexp_replace(b.phone, '\D', '', 'g')
            = regexp_replace(r.phone, '\D', '', 'g')
        and b.status <> 'cancelled'
    ) then
      raise notice '건너뜀 (이미 있음): %', r.name;
      continue;
    end if;

    insert into bookings (
      code, event_id, tier_id, user_id, name, phone, gender,
      quantity, amount, invite_code, status, paid_at, expires_at
    ) values (
      'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
      v_event, v_tier, null, r.name, r.phone, r.gender,
      1, r.amount, v_code,
      case when r.paid then 'paid' else 'pending' end,
      case when r.paid then now() else null end,
      -- 입금이 끝난 건은 풀릴 일이 없다. 그래도 컬럼이 비면 안 되니
      -- 행사 뒤로 밀어 둔다
      case when r.paid then now() + interval '365 days'
           else now() + interval '24 hours' end
    );
    n := n + 1;
  end loop;

  raise notice '넣은 건수: %', n;
end $add$;

-- ─────────────────────────────────────────── 확인

select b.code as 예매번호,
       b.name as 이름,
       b.phone as 연락처,
       case b.gender when 'F' then '여' else '남' end as 성별,
       b.amount as 금액,
       coalesce(b.invite_code, '—') as 초대,
       b.status as 상태
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.status <> 'cancelled'
order by b.created_at desc
limit 10;
