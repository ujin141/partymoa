-- 홍보 사진과 기록 사진을 나눈다. **RECAP_PHOTOS.sql 을 돌린 뒤에 돌린다.**
--
-- 지금은 한 파티의 사진이 한 통에 섞여 있다. 그래서 끝난 파티를 열면
-- **그날 찍지도 않은 홍보 컷 5장이 기록 맨 앞에 선다.** 기록이 기록이
-- 아니게 된다.
--
-- 경로로 구분할 수도 있었지만(/recap/ 이 들어갔나) 그건 파일을 어디에
-- 뒀는지에 기대는 방식이라, 다음 파티에서 크루가 스토리지에 올리면
-- 바로 깨진다. 종류는 종류로 적는다.

alter table event_photos
  add column if not exists kind text not null default 'promo'
    check (kind in ('promo', 'recap'));

-- 이번 행사 기록 16장을 표시한다
update event_photos set kind = 'recap'
where url like '/photos/after-sunset/recap/%';

-- ─────────────────────────────────────────── 확인
select kind, count(*) from event_photos group by kind order by kind;
