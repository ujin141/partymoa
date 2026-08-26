-- 명단 전체 성별 맞추기. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- 성별은 **성비 정원에 그대로 들어간다.** 한 건이 틀어져 있으면 남녀
-- 잔여가 한 자리씩 어긋나고 마감 판단도 같이 틀어진다.
--
-- ## 이름이 아니라 번호로 찾는다
--
-- 동명이인이 있으면 이름으로는 누구인지 못 고른다. 번호는 그 사람
-- 것이다. 하이픈·점이 섞여 있어도(010-0000-0000, 010.0000.0000)
-- 숫자만 뽑아 비교하므로 그대로 붙여 넣으면 된다.
--
-- ## 못 찾은 사람은 멈추지 않고 넘어간다
--
-- 39건을 한 번에 도는데 첫 번째에서 멈추면 나머지를 못 고친다.
-- 못 찾은 사람은 아래에 목록으로 뜬다 — 그건 따로 확인한다.
--
-- **성별만 바꾼다.** 추천인과 금액은 안 건드린다.

--
--  ** 실제 손님 번호를 이 파일에 남기지 마세요. ** 이 저장소는 공개입니다.
--  아래 표에 번호를 붙여 넣고 SQL 편집기에서 돌린 뒤, 파일은 그대로
--  두세요. 실제로 돌린 목록은 커밋하지 않습니다.

do $g$
declare
  v_event uuid;
  v_digits text;
  v_hit   int;
  r       record;
  n       int := 0;
  same    int := 0;
  miss    text[] := '{}';
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  for r in
    select * from (values
      -- 연락처,          이름,   성별
      ('010-0000-0000', '보기', 'F')
    ) as t(phone, name, gender)
  loop
    v_digits := regexp_replace(r.phone, '\D', '', 'g');

    -- 같은 번호로 두 건을 잡았을 수도 있다. 같은 사람이므로 다 바꾼다
    update bookings b
       set gender = r.gender
     where b.event_id = v_event
       and b.status <> 'cancelled'
       and regexp_replace(b.phone, '\D', '', 'g') = v_digits
       and b.gender <> r.gender;
    get diagnostics v_hit = row_count;

    if v_hit > 0 then
      n := n + v_hit;
      raise notice '% → %', r.name, r.gender;
    else
      -- 안 바뀐 이유가 둘이다. 이미 맞거나, 명단에 없거나
      if exists (
        select 1 from bookings b
        where b.event_id = v_event
          and b.status <> 'cancelled'
          and regexp_replace(b.phone, '\D', '', 'g') = v_digits
      ) then
        same := same + 1;
      else
        miss := miss || (r.name || ' ' || r.phone);
      end if;
    end if;
  end loop;

  raise notice '─────────────';
  raise notice '바꾼 건수: %  ·  이미 맞던 건수: %', n, same;
  if array_length(miss, 1) > 0 then
    raise notice '명단에서 못 찾음 (%건): %', array_length(miss, 1),
      array_to_string(miss, ' / ');
  else
    raise notice '전원 명단에 있습니다.';
  end if;
end $g$;

-- ─────────────────────────────────────────── 확인
--
-- 성비가 정원을 넘었는지 본다. 넘어도 이미 받은 예매는 되돌리지 않는다 —
-- 넘은 채로 두고 크루가 판단한다. 다만 그 뒤로 그 성별 예매는 닫힌다.

select e.capacity as 정원,
       floor(e.capacity / 2.0)::int as 성별정원,
       s.booked_f as 여성, s.booked_m as 남성,
       floor(e.capacity / 2.0)::int - s.booked_f as 여성잔여,
       floor(e.capacity / 2.0)::int - s.booked_m as 남성잔여
from event_stats s
join events e on e.id = s.event_id
where e.slug = 'after-sunset-20260829';

select case b.gender when 'F' then '여' else '남' end as 성별,
       count(*) as 건수, sum(b.quantity) as 인원
from bookings b
join events e on e.id = b.event_id
where e.slug = 'after-sunset-20260829'
  and b.status <> 'cancelled'
group by b.gender;
