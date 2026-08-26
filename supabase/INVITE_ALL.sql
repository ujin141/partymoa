-- 추천인 일괄 배정. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- 목록에 적힌 추천인 표기가 제각각이었다 —
--   DJ LYNN · Lynn · lynn · DJ_Lynn · 세린   →  전부 LYNN
--   DJ TS (김정훈) · DJ.TS                   →  TS
--   DJ XANTHIC · Xanthic                     →  XANTHIC
--   chips · CHIPS · Chips                    →  CHIPS
-- 코드는 하나로 모아야 집계가 한 줄로 선다.
--
-- ## 금액은 안 건드린다
--
-- 코드를 붙이면 게스트가(30,000)를 줘야 할 것 같지만, 이미 다른 금액으로
-- 입금이 끝난 건이 섞여 있다. **돈은 눈으로 보고 정한다** — 맨 아래
-- select 가 게스트가가 아닌 건을 뽑아 준다. 거기서 고를 것만
-- 명단 화면의 [추천인] 버튼으로 다시 계산시키면 된다.

--
--  ** 실제 손님 번호를 이 파일에 남기지 마세요. ** 이 저장소는 공개입니다.
--  아래 표에 번호를 붙여 넣고 SQL 편집기에서 돌린 뒤, 파일은 그대로
--  두세요. 실제로 돌린 목록은 커밋하지 않습니다.

do $inv$
declare
  v_event uuid;
  v_crew  uuid;
  v_digits text;
  v_hit   int;
  r       record;
  n       int := 0;
  miss    text[] := '{}';
  nocode  text[] := '{}';
begin
  select id, crew_id into v_event, v_crew
  from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  -- ── 1. 없는 멤버를 만든다 ───────────────────────────
  --
  -- **코드는 짐작한 것이다.** 송우진만 확인받았고 나머지 셋은 이름을
  -- 그대로 코드로 썼다. 다르면 아래 세 줄만 고치고 다시 돌리면 된다.
  insert into crew_members (crew_id, display_name, invite_code, role)
  values
    (v_crew, '송우진', 'WOOJIN', 'member'),
    (v_crew, 'CHIPS',  'CHIPS',  'member'),
    (v_crew, 'HEIDY',  'HEIDY',  'member'),
    (v_crew, 'DEMIC',  'DEMIC',  'member')
  on conflict (crew_id, invite_code) do nothing;

  -- ── 2. 예매마다 코드를 붙인다 ───────────────────────
  for r in
    select * from (values
      -- 연락처,          이름,   코드
      ('010-0000-0000', '보기', 'LYNN')
    ) as t(phone, name, code)
  loop
    -- 코드가 크루에 없으면 붙이지 않는다. 없는 코드를 박아 두면
    -- 어느 집계에도 안 잡히면서 붙은 것처럼 보인다
    if not exists (
      select 1 from crew_members
      where crew_id = v_crew and invite_code = r.code
    ) then
      nocode := nocode || (r.name || ' → ' || r.code);
      continue;
    end if;

    v_digits := regexp_replace(r.phone, '\D', '', 'g');

    update bookings b
       set invite_code = r.code
     where b.event_id = v_event
       and b.status <> 'cancelled'
       and regexp_replace(b.phone, '\D', '', 'g') = v_digits
       and coalesce(b.invite_code, '') <> r.code;
    get diagnostics v_hit = row_count;

    if v_hit > 0 then
      n := n + v_hit;
    elsif not exists (
      select 1 from bookings b
      where b.event_id = v_event
        and b.status <> 'cancelled'
        and regexp_replace(b.phone, '\D', '', 'g') = v_digits
    ) then
      miss := miss || (r.name || ' ' || r.phone);
    end if;
  end loop;

  raise notice '─────────────';
  raise notice '추천인 붙인 건수: %', n;
  if array_length(nocode, 1) > 0 then
    raise notice '코드가 없어 건너뜀: %', array_to_string(nocode, ' / ');
  end if;
  if array_length(miss, 1) > 0 then
    raise notice '명단에서 못 찾음 (%건): %', array_length(miss, 1),
      array_to_string(miss, ' / ');
  else
    raise notice '전원 명단에 있습니다.';
  end if;
end $inv$;

-- ─────────────────────────────────────────── 확인

-- 추천인별 집계. 크루 현황의 [멤버별 초대] 와 같은 숫자여야 한다
select coalesce(b.invite_code, '— 없음') as 추천인,
       count(*) as 건수, sum(b.quantity) as 인원, sum(b.amount) as 매출
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.status <> 'cancelled'
group by b.invite_code
order by 인원 desc;

-- **게스트가가 아닌 게스트.** 여기 뜨는 사람은 금액을 손볼지 정해야 한다.
-- 이미 그 금액으로 입금이 끝났으면 그대로 두는 게 맞을 수도 있다
select b.code as 예매번호, b.name as 이름, b.invite_code as 추천인,
       b.amount as 지금금액, e.guest_price as 게스트가, b.status as 상태
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.status <> 'cancelled'
  and b.invite_code is not null
  and b.table_id is null
  and b.amount <> e.guest_price
order by b.name;
