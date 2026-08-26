-- ═══════════════════════════════════════════════════════════════════
--  둘러보기 필터에 필요한 칸
--
--  갈래(소셜/솔로 · 클럽/DJ · 풀/루프탑 · 술/라운지 · 글로벌 ·
--  취미/모임)는 크루가 적은 태그로 가릅니다. 따로 저장할 게 없습니다.
--
--  그런데 필터 중 셋은 태그로 알 수 없습니다.
--
--    연령대       — "20대 초반" 이라고 태그에 적는 크루는 없다
--    한국인/외국인 — 분위기지 장르가 아니다
--    커플 환영     — solo_friendly 의 반대말이 아니다. 둘 다 참일 수 있다
--
--  **비워 둘 수 있게 만듭니다.** 안 적은 파티가 목록에서 사라지면
--  그건 크루에게 벌을 주는 것입니다. 비어 있으면 그 필터가 그 파티를
--  거르지 않습니다.
--
--  두 번 돌려도 안전합니다.
-- ═══════════════════════════════════════════════════════════════════

alter table events add column if not exists age_min int;
alter table events add column if not exists age_max int;
alter table events add column if not exists couple_friendly boolean not null default false;
alter table events add column if not exists crowd text;

do $$ begin
  alter table events add constraint events_age_check
    check (
      (age_min is null or age_min between 19 and 99) and
      (age_max is null or age_max between 19 and 99) and
      (age_min is null or age_max is null or age_min <= age_max)
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table events add constraint events_crowd_check
    check (crowd is null or crowd in ('korean', 'mixed', 'global'));
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────── AFTER SUNSET
--
--  아는 것만 채웁니다. 연령대는 우진이 정해서 앱에서 넣으세요 —
--  여기에 추측으로 적으면 그게 손님에게 그대로 보입니다.

update events
set couple_friendly = true,
    crowd = coalesce(crowd, 'korean')
where slug = 'after-sunset-20260829';

-- ─────────────────────────────────────────── 확인

select slug            as 파티,
       solo_friendly   as 혼자,
       couple_friendly as 커플,
       coalesce(crowd, '미정') as 구성,
       coalesce(age_min::text, '—') || '~' || coalesce(age_max::text, '—') as 연령대
from events
order by starts_at desc;
