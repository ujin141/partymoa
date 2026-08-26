import Link from "next/link";
import { Suspense } from "react";

import { PartyCard } from "@/components/PartyCard";
import { SearchBar } from "@/components/SearchBar";
import { Empty } from "@/components/ui/primitives";
import { seoulWeekday } from "@/lib/format";
import { listAreas, listOpenParties, type PartyCardData } from "@/lib/queries";
import { soldRate } from "@/lib/rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "둘러보기" };

const CHIPS = [
  "전체",
  "1인 참여",
  "풀파티",
  "루프탑",
  "테크노",
  "이번 주말",
] as const;

const SORTS = {
  latest: "최신순",
  hot: "인기순",
  soon: "임박순",
} as const;

type Sort = keyof typeof SORTS;

function isWeekend(iso: string) {
  const d = new Date(iso);
  const days = (d.getTime() - Date.now()) / 86400000;
  // 요일도 서울 기준이다. UTC 서버에서 재면 토요일 새벽 행사가
  // 금요일로 밀린다
  const w = seoulWeekday(iso);
  return days >= 0 && days <= 7 && (w === 5 || w === 6);
}

function matchesCategory(cat: string, e: PartyCardData["event"]) {
  if (cat === "전체") return true;
  if (cat === "1인 참여") return e.solo_friendly;
  if (cat === "이번 주말") return isWeekend(e.starts_at);
  return e.categories.includes(cat) || e.genres.includes(cat);
}

/** 제목·장소·지역·크루·장르를 한 번에 훑는다. 사람이 뭘 칠지 모른다 */
function matchesQuery(q: string, d: PartyCardData) {
  if (!q) return true;
  const hay = [
    d.event.title,
    d.event.subtitle ?? "",
    d.event.venue_name,
    d.event.area,
    d.crew.name,
    ...d.event.genres,
    ...d.event.categories,
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{
    cat?: string;
    sort?: string;
    crew?: string;
    area?: string;
    q?: string;
  }>;
}) {
  const [sp, all, areas] = await Promise.all([
    searchParams,
    listOpenParties(),
    listAreas(),
  ]);

  const cat =
    sp.cat && CHIPS.includes(sp.cat as (typeof CHIPS)[number]) ? sp.cat : "전체";
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "latest";
  const area = sp.area && areas.includes(sp.area) ? sp.area : "전체";
  const q = (sp.q ?? "").trim();

  let list = all;
  if (sp.crew) list = list.filter((d) => d.crew.slug === sp.crew);
  if (area !== "전체") list = list.filter((d) => d.event.area === area);
  list = list.filter((d) => matchesCategory(cat, d.event));
  list = list.filter((d) => matchesQuery(q, d));

  if (sort === "hot") {
    list = [...list].sort(
      (a, b) =>
        soldRate(b.stats.booked, b.stats.capacity) -
        soldRate(a.stats.booked, a.stats.capacity),
    );
  } else if (sort === "soon") {
    list = [...list].sort(
      (a, b) => +new Date(a.event.starts_at) - +new Date(b.event.starts_at),
    );
  } else {
    list = [...list].sort(
      (a, b) => +new Date(b.event.created_at) - +new Date(a.event.created_at),
    );
  }

  const href = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { cat, sort, area, ...(q ? { q } : {}), ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "전체") p.set(k, v);
    }
    if (sp.crew) p.set("crew", sp.crew);
    const s = p.toString();
    return s ? `/explore?${s}` : "/explore";
  };

  const filtered = cat !== "전체" || area !== "전체" || q || sp.crew;

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3.5">
        <span className="text-[17px] font-extrabold">둘러보기</span>
        <span className="ml-auto text-[13px] text-sub">{list.length}개</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Suspense fallback={<div className="h-[62px]" />}>
          <SearchBar />
        </Suspense>

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-0.5 pt-3">
          {CHIPS.map((c) => (
            <Link
              key={c}
              href={href({ cat: c })}
              scroll={false}
              className={`flex-none rounded-full border px-3.5 py-2 text-[13.5px] transition active:scale-95 ${
                c === cat
                  ? "border-ink bg-ink font-semibold text-white"
                  : "border-line bg-white font-medium text-sub"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>

        {areas.length > 1 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2">
            {["전체", ...areas].map((a) => (
              <Link
                key={a}
                href={href({ area: a })}
                scroll={false}
                className={`flex-none rounded-full border px-3 py-1.5 text-[13px] transition active:scale-95 ${
                  a === area
                    ? "border-brand bg-brand-soft font-semibold text-brand"
                    : "border-line bg-white text-sub"
                }`}
              >
                {a === "전체" ? "지역 전체" : a}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3 px-4 pb-3 pt-3.5">
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <Link
              key={s}
              href={href({ sort: s })}
              scroll={false}
              className={`text-[13px] ${
                s === sort ? "font-bold text-ink" : "text-sub"
              }`}
            >
              {SORTS[s]}
            </Link>
          ))}
          {filtered ? (
            <Link
              href="/explore"
              scroll={false}
              className="ml-auto text-[12.5px] text-sub underline"
            >
              필터 초기화
            </Link>
          ) : null}
        </div>

        {list.length === 0 ? (
          <Empty>
            {q ? (
              <>
                <b className="text-ink">{q}</b> 로 찾은 파티가 없어요.
                <br />
                다른 말로 찾아보세요.
              </>
            ) : (
              <>
                조건에 맞는 파티가 없어요.
                <br />
                필터를 바꿔 보세요.
              </>
            )}
          </Empty>
        ) : (
          list.map((d) => <PartyCard key={d.event.id} d={d} />)
        )}
        <div className="h-4" />
      </div>
    </>
  );
}
