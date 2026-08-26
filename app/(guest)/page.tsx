import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { HeroCard, MiniRow, PartyCard } from "@/components/PartyCard";
import { Wordmark } from "@/components/Symbol";
import { Divider, Empty, SectionTitle } from "@/components/ui/primitives";
import { listAreas, listCrews, listOpenParties } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { seoulWeekday } from "@/lib/format";
import { isClosingSoon, soldRate } from "@/lib/rules";

// **캐시를 안 쓴다.** 찜은 사람마다 다르고 잔여는 초 단위로 바뀐다.
// revalidate 를 걸어 두면 남의 찜과 지난 잔여가 그대로 나간다
export const dynamic = "force-dynamic";

function isThisWeekend(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = (d.getTime() - now.getTime()) / 86400000;
  // 요일도 서울 기준이다. UTC 서버에서 재면 토요일 새벽 행사가
  // 금요일로 밀린다
  const w = seoulWeekday(iso);
  return days >= 0 && days <= 7 && (w === 5 || w === 6);
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [parties, crews, areas, { data: profile }, { count: unpaidCount }] =
    await Promise.all([
    listOpenParties(),
    listCrews(),
    listAreas(),
    // 시작 화면에서 고른 취향. 안 고른 사람은 예전과 똑같이 보인다
    user && !user.is_anonymous
      ? supabase
          .from("profiles")
          .select("areas, categories, nickname")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // 미입금이 있으면 티켓 아이콘에 점을 찍는다. 24시간 지나면 자리가
    // 풀리는데, 그걸 잊는 게 제일 흔한 사고다
    user
      ? supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const unpaid = unpaidCount ?? 0;

  let me = profile as {
    areas: string[];
    categories: string[];
    nickname: string | null;
  } | null;

  // 로그인 전에 고른 취향은 쿠키에 있다. 프로필이 있으면 그쪽이 이긴다
  if (!me) {
    const raw = (await cookies()).get("pm_prefs")?.value;
    if (raw) {
      try {
        const v = JSON.parse(decodeURIComponent(raw)) as {
          areas?: string[];
          categories?: string[];
        };
        me = {
          areas: Array.isArray(v.areas) ? v.areas : [],
          categories: Array.isArray(v.categories) ? v.categories : [],
          nickname: null,
        };
      } catch {
        // 손댄 쿠키. 그냥 취향 없는 것으로 본다
      }
    }
  }

  /**
   * 취향에 맞는 파티. **지역이나 분위기 중 하나만 걸려도 넣는다** —
   * 둘 다 맞아야 한다고 하면 서울에 파티가 몇 개 없는 지금은 거의 늘
   * 빈 칸이 된다.
   *
   * 장르도 분위기로 친다. 크루가 '테크노' 를 장르에 넣었는지 카테고리에
   * 넣었는지는 고르는 사람 입장에서 아무 상관이 없다.
   */
  const liked =
    me && (me.areas.length || me.categories.length)
      ? parties.filter(
          (p) =>
            me.areas.includes(p.event.area) ||
            [...p.event.categories, ...p.event.genres].some((t) =>
              me.categories.includes(t),
            ),
        )
      : [];

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

  /**
   * **한 파티가 여러 칸에 겹쳐 나오지 않게 한다.**
   *
   * 파티가 하나뿐일 때 이 화면은 같은 카드를 세 번 보여 줬다 — 지금
   * 뜨는 파티, 혼자 가도 좋아요, 이번 주말. 스크롤을 내리면 같은 사진이
   * 계속 나와서 앱이 고장 난 것처럼 보인다.
   *
   * 위에서부터 먼저 나온 칸이 이긴다. 아래 칸은 남은 것만 받고, 남은 게
   * 없으면 칸 자체가 사라진다.
   */
  const shown = new Set<string>();
  const take = <T extends { event: { id: string } }>(list: T[], n: number) => {
    const out = list.filter((d) => !shown.has(d.event.id)).slice(0, n);
    out.forEach((d) => shown.add(d.event.id));
    return out;
  };
  const sLiked = take(liked, 5);
  const sRate = take(byRate, 5);
  const sSolo = take(solo, 3);
  const sClosing = take(closing, 4);
  const sWeekend = take(weekend, 5);

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Wordmark />

        {/* 아래 탭이 있는데도 위에 또 두는 이유 — 폰을 한 손으로 잡으면
            엄지가 화면 위쪽에 있고, 홈에서 제일 자주 가는 곳이 이 둘이다.
            미입금이 있으면 티켓에 점을 찍는다. 그게 잊어버리는 것이다 */}
        <nav className="ml-auto flex items-center gap-1">
          <Link
            href="/tickets"
            aria-label="내 티켓"
            className="relative grid h-9 w-9 place-items-center rounded-full active:bg-soft"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[21px] w-[21px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4z" />
            </svg>
            {unpaid > 0 ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-hot ring-2 ring-white" />
            ) : null}
          </Link>
          <Link
            href="/my"
            aria-label="마이"
            className="grid h-9 w-9 place-items-center rounded-full active:bg-soft"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[21px] w-[21px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
            </svg>
          </Link>
        </nav>
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

        {sLiked.length > 0 ? (
          <>
            <SectionTitle
              title={me?.nickname ? `${me.nickname} 님 취향` : "취향에 맞는 파티"}
              note="시작할 때 고른 지역·분위기로 골랐어요"
            />
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {sLiked.map((d) => (
                <HeroCard key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {sRate.length > 0 ? (
          <>
            <SectionTitle title="지금 뜨는 파티" note="예매가 빠르게 차는 순서" />
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {sRate.map((d) => (
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

        {sSolo.length > 0 ? (
          <>
            <Divider />
            <SectionTitle
              title="혼자 가도 좋아요"
              note="1인 참여를 환영하는 파티만 모았어요"
            />
            {sSolo.map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        {sClosing.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="마감 임박" note="자리가 얼마 안 남았어요" />
            {sClosing.map((d, i) => (
              <MiniRow key={d.event.id} d={d} rank={i + 1} />
            ))}
          </>
        ) : null}

        {sWeekend.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="이번 주말" note="금·토에 열리는 파티" />
            {sWeekend.map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        <div className="h-4" />
      </div>
    </>
  );
}
