-- 끝난 파티를 공개한다. **RECAP.sql · RECAP_PHOTOS.sql 을 돌린 뒤 이걸 돌린다.**
--
-- ## 무엇이 잘못돼 있었나
--
-- 정책이 `status = 'open'` 하나였다. 그래서 행사를 done 으로 바꾸는 순간
-- 파티가 익명 사용자에게서 **통째로 사라진다** — 페이지도 404, 사진도 0장.
-- 사진 정책은 이미 open·closed·done 을 허용하고 있었지만, 그 안의
-- exists 가 events 를 다시 읽기 때문에 events 정책에서 먼저 막혔다.
--
-- 집계 뷰만 나왔던 건 뷰가 소유자 권한으로 돌아서다. 그래서 숫자는
-- 보이는데 사진은 안 보이는, 사람 헷갈리는 모양이 나왔다.
--
-- ## 무엇으로 바꾸나
--
-- draft 만 가린다. 준비 중인 파티는 계속 안 보이고, 마감·종료는 열린다.
-- 앱 화면이 이미 그 기준으로 판단한다(draft 면 404, 아니면 연다).
--
-- **공개 범위가 넓어지는 게 아니다.** events 행에는 이름도 연락처도 없다.
-- 예매(bookings) 정책은 손대지 않는다.

drop policy if exists events_read_open on events;
create policy events_read_open on events
  for select using (status <> 'draft' or is_crew_staff(crew_id));

-- ─────────────────────────────────────────── 확인
-- 익명으로 보이는지 본다. 0 이 나오면 안 된다.

set local role anon;
select status, count(*) from events group by status order by status;
select count(*) as 기록사진 from event_photos
where url like '/photos/after-sunset/recap/%';
reset role;
