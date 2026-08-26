import Link from "next/link";
import { Suspense } from "react";

import { PartyCard } from "@/components/PartyCard";
import { ExploreFilters } from "@/components/ExploreFilters";
import { SearchBar } from "@/components/SearchBar";
import { Empty } from "@/components/ui/primitives";
import { passesFilters, type FilterKey } from "@/lib/filters";
import { GENRES, genreByKey, inGenre } from "@/lib/genres";
import { listAreas, listOpenParties, type PartyCardData } from "@/lib/queries";
import { soldRate } from "@/lib/rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "둘러보기" };

const SORTS = {
  latest: "최신순",
  hot: "🔥 예약 많은 순",
  soon: "임박순",
} as const;

type Sort = keyof typeof SORTS;

/** 제목·장소·지역·호스트·장르를 한 번에 훑는다. 사람이 뭘 칠지 모른다 */
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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [sp, all, areas] = await Promise.all([
    searchParams,
    listOpenParties(),
    listAreas(),
  ]);

  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "latest";
  const q = (sp.q ?? "").trim();
  const genre = genreByKey(sp.g);

  // 켜져 있는 필터만 모은다. 없는 지역이 걸려 있으면 무시한다
  const KEYS: FilterKey[] = [
    "area",
    "date",
    "age",
    "rel",
    "music",
    "crowd",
    "price",
  ];
  const on: Partial<Record<FilterKey, string>> = {};
  for (const k of KEYS) {
    const v = sp[k];
    if (!v) continue;
    if (k === "area" && !areas.includes(v)) continue;
    on[k] = v;
  }

  let list = all;
  // 갈래가 먼저다. 그 안에서 필터·검색으로 좁힌다
  if (genre) list = list.filter((d) => inGenre(genre, d.event));
  if (sp.crew) list = list.filter((d) => d.crew.slug === sp.crew);
  list = list.filter((d) => passesFilters(d, on));
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
    const merged: Record<string, string | undefined> = {
      sort,
      ...on,
      ...(genre ? { g: genre.key } : {}),
      ...(q ? { q } : {}),
      ...(sp.crew ? { crew: sp.crew } : {}),
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `/explore?${s}` : "/explore";
  };

  const filtered =
    Object.keys(on).length > 0 ||
    Boolean(q) ||
    Boolean(sp.crew) ||
    Boolean(genre);

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

        {/* **갈래가 먼저다.** 태그 줄은 이미 뭘 찾는지 아는 사람에게만
            쓸모가 있다. 처음 온 사람은 여기서 고른다 */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
          <Link
            href={href({ g: "" })}
            scroll={false}
            className={`flex-none rounded-full border px-4 py-2 text-[14px] transition active:scale-95 ${
              genre
                ? "border-line bg-white font-medium text-sub"
                : "border-brand bg-brand font-bold text-white"
            }`}
          >
            전체
          </Link>
          {GENRES.map((g) => (
            <Link
              key={g.key}
              href={href({ g: g.key })}
              scroll={false}
              className={`flex flex-none items-center gap-1 rounded-full border px-4 py-2 text-[14px] transition active:scale-95 ${
                genre?.key === g.key
                  ? "border-brand bg-brand font-bold text-white"
                  : "border-line bg-white font-medium text-sub"
              }`}
            >
              <span aria-hidden="true">{g.icon}</span>
              {g.label}
            </Link>
          ))}
        </div>

        {/* 갈래 안에서 조건을 겹친다. 칩 하나가 항목 하나고, 누르면
            시트가 올라온다 */}
        <Suspense fallback={<div className="h-[42px]" />}>
          <ExploreFilters areas={areas} />
        </Suspense>

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
