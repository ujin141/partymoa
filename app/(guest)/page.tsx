import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { HomeBanner, type BannerItem } from "@/components/HomeBanner";
import {
  HeroCard,
  MiniRow,
  PartyCard,
  PartyTile,
  SquareTile,
} from "@/components/PartyCard";
import { Wordmark } from "@/components/Symbol";
import { Divider, Empty, SectionTitle } from "@/components/ui/primitives";
import { homeExtras, listAreas, listCrews, listOpenParties } from "@/lib/queries";
import { seoulWeekday, shortDate } from "@/lib/format";
import { isClosingSoon, soldRate } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";

// **캐시를 안 쓴다.** 찜은 사람마다 다르고 잔여는 초 단위로 바뀐다.
// revalidate 를 걸어 두면 남의 찜과 지난 잔여가 그대로 나간다
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    parties,
    crews,
    areas,
    extras,
    { data: profile },
    { count: unpaidCount },
  ] = await Promise.all([
    listOpenParties(),
    listCrews(),
    listAreas(),
    homeExtras(),
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
   * 장르도 분위기로 친다. 호스트가 '테크노' 를 장르에 넣었는지 카테고리에
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

  /**
   * **칸을 줄인다.**
   *
   * 예전에는 지금 뜨는 파티 · 혼자 가도 좋아요 · 마감 임박 · 이번 주말이
   * 각각 칸이었다. 서울에 파티가 매일 열리는 게 아니라서, 그 넷이 전부
   * 같은 파티 한 장으로 채워졌다. 스크롤을 내리면 같은 사진이 계속
   * 나온다.
   *
   * 그 넷은 이제 둘러보기의 필터다(❤️ 솔로/커플 · 📅 날짜 · 🔥 예약
   * 많은 순). 홈은 **한 목록**만 보여 준다 — 다가오는 순서로.
   */
  const upcoming = [...parties].sort(
    (a, b) => +new Date(a.event.starts_at) - +new Date(b.event.starts_at),
  );

  /**
   * 칸마다 다른 파티를 보여 주려는 게 아니라 **다른 각도로** 보여
   * 준다. 같은 파티가 여러 칸에 나오는 건 괜찮다 — 어느 각도에서
   * 걸릴지는 사람마다 다르다.
   */
  const byRate = [...parties].sort(
    (a, b) =>
      soldRate(b.stats.booked, b.stats.capacity) -
      soldRate(a.stats.booked, a.stats.capacity),
  );
  // **정말 임박한 것만.** 예매율 순으로 자르면 0% 팔린 파티가 1위가 된다
  const closing = byRate.filter((p) =>
    isClosingSoon(p.stats.booked, p.stats.capacity),
  );
  const solo = parties.filter((p) => p.event.solo_friendly);
  const weekend = parties.filter((p) => {
    const d = (+new Date(p.event.starts_at) - Date.now()) / 86400000;
    // 요일도 서울 기준이다. UTC 서버에서 재면 토요일 새벽이 금요일로 밀린다
    const w = seoulWeekday(p.event.starts_at);
    return d >= 0 && d <= 7 && (w === 5 || w === 6);
  });

  const showLiked = liked.length > 0 && liked.length < parties.length;

  /**
   * 배너에 올릴 것.
   *
   * **취향에 맞는 것을 앞에 세운다.** 없으면 예매가 빠르게 차는
   * 순서다 — 남들이 몰리는 판이 대개 제일 볼 만한 판이다.
   *
   * 다섯 장까지. 그 이상은 아무도 안 넘긴다.
   */
  const banner: BannerItem[] = (showLiked ? liked : parties)
    .slice()
    .sort(
      (a, b) =>
        soldRate(b.stats.booked, b.stats.capacity) -
        soldRate(a.stats.booked, a.stats.capacity),
    )
    .slice(0, 5)
    .map((d) => ({
      slug: d.event.slug,
      title: d.event.title,
      cover: d.event.cover_url || "",
      line: `${shortDate(d.event.starts_at)} · ${d.event.venue_name} · ${d.event.area}`,
      badge: isClosingSoon(d.stats.booked, d.stats.capacity)
        ? `${Math.max(0, d.stats.capacity - d.stats.booked)}자리 남음`
        : d.event.solo_friendly
          ? "1인 환영"
          : null,
    }))
    .filter((b) => b.cover);

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

        {/* 맨 위는 배너다. 갈래 칸은 둘러보기로 옮겼다 — 홈은
            "뭐가 있나" 를 보는 곳이고, 좁히는 건 거기서 한다 */}
        {banner.length > 0 ? <HomeBanner items={banner} /> : null}

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
            호스트가 파티를 올리면 여기에 보입니다.
          </Empty>
        ) : null}

        {showLiked ? (
          <>
            <SectionTitle
              title={me?.nickname ? `${me.nickname} 님 취향` : "취향에 맞는 파티"}
              note="시작할 때 고른 지역·분위기로 골랐어요"
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-1">
              {liked.slice(0, 4).map((d) => (
                <PartyTile key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {/* **제일 촘촘한 칸을 맨 앞에 둔다.** 한 화면에 네 개가 들어와서
            "뭐가 있나" 가 바로 잡힌다 */}
        {upcoming.length > 0 ? (
          <>
            <SectionTitle title="다가오는 파티" note="빠른 날짜 순서" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-1">
              {upcoming.slice(0, 8).map((d) => (
                <PartyTile key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {byRate.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="지금 뜨는 파티" note="예매가 빠르게 차는 순서" />
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {byRate.slice(0, 6).map((d) => (
                <HeroCard key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {solo.length > 0 ? (
          <>
            <Divider />
            <SectionTitle
              title="혼자 가도 좋아요"
              note="1인 참여를 환영하는 파티만"
            />
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
              {solo.slice(0, 8).map((d) => (
                <SquareTile key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {closing.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="마감 임박" note="자리가 얼마 안 남았어요" />
            {closing.slice(0, 5).map((d, i) => (
              <MiniRow key={d.event.id} d={d} rank={i + 1} />
            ))}
          </>
        ) : null}

        {weekend.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="이번 주말" note="금·토에 열리는 파티" />
            {weekend.slice(0, 3).map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        {/* 커버 한 장으로는 어떤 파티인지 안 전해진다 */}
        {extras.photos.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="현장" note="이런 분위기예요" />
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
              {extras.photos.map((p) => (
                <Link
                  key={p.id}
                  href={`/party/${p.slug}`}
                  className="relative h-[150px] w-[112px] flex-none overflow-hidden rounded-xl bg-soft"
                >
                  <Image
                    src={p.url}
                    alt={p.caption ?? ""}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {crews.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="호스트" note="파티를 여는 사람들" />
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

        <div className="h-4" />
      </div>
    </>
  );
}
