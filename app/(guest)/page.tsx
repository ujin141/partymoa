import Image from "next/image";
import Link from "next/link";

import { HeroCard, MiniRow, PartyCard } from "@/components/PartyCard";
import { Wordmark } from "@/components/Symbol";
import { Divider, Empty, SectionTitle } from "@/components/ui/primitives";
import { listAreas, listCrews, listOpenParties } from "@/lib/queries";
import { isClosingSoon, soldRate } from "@/lib/rules";

// **캐시를 안 쓴다.** 찜은 사람마다 다르고 잔여는 초 단위로 바뀐다.
// revalidate 를 걸어 두면 남의 찜과 지난 잔여가 그대로 나간다
export const dynamic = "force-dynamic";

function isThisWeekend(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = (d.getTime() - now.getTime()) / 86400000;
  return days >= 0 && days <= 7 && (d.getDay() === 5 || d.getDay() === 6);
}

export default async function HomePage() {
  const [parties, crews, areas] = await Promise.all([
    listOpenParties(),
    listCrews(),
    listAreas(),
  ]);

  const byRate = [...parties].sort(
    (a, b) =>
      soldRate(b.stats.booked, b.stats.capacity) -
      soldRate(a.stats.booked, a.stats.capacity),
  );
  // **정말 임박한 것만.** 예매율 순으로 자르면 0% 팔린 파티가 1위로 올라온다
  const closing = byRate.filter((p) =>
    isClosingSoon(p.stats.booked, p.stats.capacity),
  );
  const solo = parties.filter((p) => p.event.solo_friendly);
  const weekend = parties.filter((p) => isThisWeekend(p.event.starts_at));

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Wordmark />
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Link
          href="/explore"
          className="mx-4 mt-3.5 flex items-center gap-2 rounded-xl bg-soft px-3.5 py-3 text-[14.5px] text-sub transition active:opacity-70"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px] flex-none fill-none stroke-sub stroke-2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          어떤 파티를 찾으세요?
        </Link>

        {areas.length > 1 ? (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
            {areas.map((a) => (
              <Link
                key={a}
                href={`/explore?area=${encodeURIComponent(a)}`}
                className="flex-none rounded-full border border-line px-3 py-1.5 text-[13px] text-sub transition active:scale-95"
              >
                {a}
              </Link>
            ))}
          </div>
        ) : null}

        {parties.length === 0 ? (
          <Empty>
            아직 열린 파티가 없어요.
            <br />
            크루가 파티를 올리면 여기에 보입니다.
          </Empty>
        ) : null}

        {byRate.length > 0 ? (
          <>
            <SectionTitle title="지금 뜨는 파티" note="예매가 빠르게 차는 순서" />
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {byRate.slice(0, 5).map((d) => (
                <HeroCard key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {crews.length > 0 ? (
          <>
            <SectionTitle title="크루" note="파티를 여는 사람들" />
            <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-1">
              {crews.map((c) => (
                <Link
                  key={c.id}
                  href={`/explore?crew=${c.slug}`}
                  className="w-[74px] flex-none text-center"
                >
                  <div className="h-[74px] w-[74px] overflow-hidden rounded-full border-2 border-brand bg-soft p-0.5">
                    {c.avatar_url ? (
                      <Image
                        src={c.avatar_url}
                        alt=""
                        width={74}
                        height={74}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">
                        {c.name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <span className="mt-1.5 block truncate text-xs font-semibold">
                    {c.name}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {solo.length > 0 ? (
          <>
            <Divider />
            <SectionTitle
              title="혼자 가도 좋아요"
              note="1인 참여를 환영하는 파티만 모았어요"
            />
            {solo.slice(0, 3).map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        {closing.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="마감 임박" note="자리가 얼마 안 남았어요" />
            {closing.slice(0, 4).map((d, i) => (
              <MiniRow key={d.event.id} d={d} rank={i + 1} />
            ))}
          </>
        ) : null}

        {weekend.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="이번 주말" note="금·토에 열리는 파티" />
            {weekend.map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        <div className="h-4" />
      </div>
    </>
  );
}
