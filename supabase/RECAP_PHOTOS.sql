-- AFTER SUNSET 기록. **RECAP.sql 을 먼저 돌린 뒤** 이걸 돌린다.
--
--   1. 행사를 종료(done) 로 바꾼다
--   2. 사진 16장을 붙인다
--
-- 사진 파일은 저장소에 들어 있다 — public/photos/after-sunset/recap/.
-- Storage 를 안 쓴 이유는 커버가 이미 그 방식이라서다. 규격도 맞춰 뒀다.
--
-- **끝난 파티도 페이지가 열린다.** 지우면 다음 파티를 고민하는 사람이
-- 볼 게 없다 — 처음 오는 사람이 제일 궁금해하는 건 "지난번엔 어땠나" 다.

do $rec$
declare
  v_event uuid;
  i int;
begin
  select id into v_event from events where slug = 'after-sunset-20260829';
  if v_event is null then
    raise exception '행사가 없습니다.';
  end if;

  update events set status = 'done' where id = v_event;

  -- 두 번 돌려도 안 겹치게. 기록 사진만 지우고 다시 넣는다
  delete from event_photos
  where event_id = v_event and url like '/photos/after-sunset/recap/%';

  for i in 1..16 loop
    insert into event_photos (event_id, url, caption, sort_order)
    values (v_event,
            '/photos/after-sunset/recap/' || lpad(i::text, 2, '0') || '.jpg',
            null, i);
  end loop;

  raise notice '기록 사진 16장 · 상태 done';
end $rec$;

-- ─────────────────────────────────────────── 확인

select came as 다녀감, booked as 예매, booked_f as 여, booked_m as 남,
       solo as 혼자, tables as 테이블, inviters as 추천인수
from event_recap where slug = 'after-sunset-20260829';

select count(*) as 사진 from event_photos p
join events e on e.id = p.event_id
where e.slug = 'after-sunset-20260829';
