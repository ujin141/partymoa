import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { HomeBanner, type BannerItem } from "@/components/HomeBanner";
import { HomeFeature } from "@/components/HomeFeature";
import {
  HeroCard,
  MiniRow,
  PartyCard,
  PartyTile,
  SquareTile,
} from "@/components/PartyCard";
import { Wordmark } from "@/components/Symbol";
import { Divider, SectionTitle } from "@/components/ui/primitives";
import { listPosts } from "@/lib/community";
import {
  homeExtras,
  listAreas,
  listCrews,
  listOpenParties,
  listPastParties,
  pastTotals,
  recentReviews,
} from "@/lib/queries";
import { ago, seoulWeekday, shortDate } from "@/lib/format";
import { isClosingSoon, soldRate } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";

// **캐시를 안 쓴다.** 찜은 사람마다 다르고 잔여는 초 단위로 바뀐다.
// revalidate 를 걸어 두면 남의 찜과 지난 잔여가 그대로 나간다
export const dynamic = "force-dynamic";

/** 칸 제목 옆에 붙는 '전체 보기' */
function More({ href, label = "전체 보기" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-[13px] font-semibold text-brand">
      {label}
    </Link>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    parties,
    past,
    totals,
    crews,
    areas,
    extras,
    reviews,
    posts,
    { data: profile },
    { count: unpaidCount },
  ] = await Promise.all([
    listOpenParties(),
    listPastParties(6),
    pastTotals(),
    listCrews(),
    listAreas(),
    homeExtras(),
    recentReviews(4),
    listPosts(0),
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

  const upcoming = [...parties].sort(
    (a, b) => +new Date(a.event.starts_at) - +new Date(b.event.starts_at),
  );

  /**
   * 칸마다 다른 파티를 보여 주려는 게 아니라 **다른 각도로** 보여
   * 준다. 같은 파티가 여러 칸에 나오는 건 괜찮다 — 어느 각도에서
   * 걸릴지는 사람마다 다르다.
   *
   * **다만 파티가 셋보다 적으면 그 각도 칸들을 접는다.** 파티 하나를
   * 세 칸에서 세 번 보여 주면 다른 각도가 아니라 같은 사진의 반복이다.
   * 그 자리는 라인업·현장·숫자·후기 같은, 파티 수와 상관없이 있는
   * 것들이 채운다.
   */
  const few = parties.length < 3;
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
   * **파는 게 하나도 없는 날.**
   *
   * 파티는 매주 열리지 않는다. 그 사이 기간에 홈의 모든 칸이 열린
   * 파티에 묶여 있어서, 지금까지는 검색창과 "호스트가 파티를 올리면
   * 여기에 보입니다" 만 남았다. 그건 손님이 아니라 운영자에게 하는
   * 말이고, 처음 온 사람은 그걸 보고 그냥 나간다.
   *
   * 팔 게 없으면 **다음 파티를 기다리게 만드는 것**이 홈이 할 일이다.
   */
  const quiet = parties.length === 0;

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

  // 파티가 하나뿐일 때 배너와 큰 카드가 같은 사진을 연달아 보여 준다.
  // 그럴 땐 배너를 접고 큰 카드 하나로 간다
  const showBanner = banner.length > 0 && !(few && parties.length === 1);

  const totalTiles = totals
    ? [
        { k: "연 파티 수", v: `${totals.parties}번` },
        { k: "다녀간 사람", v: `${totals.people}명` },
        { k: "혼자 온 사람", v: `${totals.solo}명` },
      ]
    : [];

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
        {showBanner ? <HomeBanner items={banner} /> : null}

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

        {quiet ? (
          <>
            <section className="px-4 pt-5">
              <p className="text-[13px] font-bold text-brand">다음 파티</p>
              <h2 className="mt-1.5 text-[23px] font-extrabold leading-snug">
                지금은 준비하는 중이에요
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-sub">
                열리면 제일 먼저 알려 드릴게요. 자리가 빨리 차는 편이라
                미리 받아 두는 게 안전해요.
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <Link
                  href="/my/alerts"
                  className="rounded-xl bg-brand py-3.5 text-center text-[15px] font-bold text-white transition active:opacity-80"
                >
                  알림 받기
                </Link>
                <Link
                  href="/explore"
                  className="rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold transition active:bg-soft"
                >
                  둘러보기
                </Link>
              </div>
            </section>

            {/* **숫자가 유일한 증거다.** 팔 게 없을 때 처음 온 사람에게
                할 수 있는 가장 정직한 이야기이기도 하다 */}
            {totals ? (
              <section className="mt-5 px-4">
                <div className="grid grid-cols-3 gap-2">
                  {totalTiles.map((x) => (
                    <div key={x.k} className="rounded-xl bg-soft px-3 py-3">
                      <small className="text-[12px] text-sub">{x.k}</small>
                      <b className="mt-0.5 block text-[19px] font-extrabold">
                        {x.v}
                      </b>
                    </div>
                  ))}
                </div>
                {totals.people > 0 ? (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
                    {`지금까지 ${totals.people}명 중 `}
                    <b className="text-ink">{`${totals.solo}명이 혼자`}</b>
                    {` 왔어요. 혼자 와도 어색하지 않은 자리를 만듭니다.`}
                  </p>
                ) : null}
              </section>
            ) : null}
          </>
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

        {/*
          파티가 적으면 한 장을 크게, 많으면 격자로.

          2열 격자에 한 장만 넣으면 오른쪽 반이 빈다. 그 자리에 세울
          다른 파티가 없으니, 넓게 쓰고 그 파티에 대해 더 말한다.
        */}
        {!quiet && few ? (
          <>
            <SectionTitle
              title="다음 파티"
              note={
                upcoming.length === 1
                  ? "지금 예매 받는 파티예요"
                  : `${upcoming.length}개 열려 있어요`
              }
            />
            <div className="grid gap-6 pb-1">
              {upcoming.map((d) => (
                <HomeFeature
                  key={d.event.id}
                  d={d}
                  djs={extras.djs.filter((x) => x.slug === d.event.slug)}
                  perks={extras.perks.filter((x) => x.slug === d.event.slug)}
                />
              ))}
            </div>
          </>
        ) : null}

        {!quiet && !few ? (
          <>
            <SectionTitle title="다가오는 파티" note="빠른 날짜 순서" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-1">
              {upcoming.slice(0, 8).map((d) => (
                <PartyTile key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {!few && byRate.length > 0 ? (
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

        {!few && solo.length > 0 ? (
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

        {weekend.length > 0 && !few ? (
          <>
            <Divider />
            <SectionTitle title="이번 주말" note="금·토에 열리는 파티" />
            {weekend.slice(0, 3).map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        {/*
          라인업. **누가 트는지가 클럽 씬에서는 실제 구매 이유다.**
          파는 파티 것만 — 지난 디제이를 세우면 오늘 오는 사람인 줄 안다.

          규격: 원 48, 이름 12.5 굵게, 시각 11.5 흐리게. 가로 한 줄.
        */}
        {extras.djs.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="라인업" note="이번에 트는 사람들" />
            <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-1">
              {extras.djs.map((x) => (
                <Link
                  key={x.id}
                  href={`/party/${x.slug}`}
                  className="w-[64px] flex-none text-center"
                >
                  <div className="relative mx-auto h-12 w-12 overflow-hidden rounded-full bg-ink">
                    {x.image ? (
                      <Image
                        src={x.image}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover object-top"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[13px] font-extrabold tracking-wide text-white">
                        {x.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="mt-1.5 block truncate text-[12.5px] font-bold">
                    {x.name}
                  </span>
                  {x.time ? (
                    <span className="block text-[11.5px] text-sub">{x.time}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {/*
          현장. **커버 한 장으로는 어떤 파티인지 안 전해진다.**

          한 줄로 흘리던 것을 3열 격자로 바꿨다. 같은 사진 여섯 장이
          한 줄에 있으면 스쳐 가고, 두 줄로 쌓이면 멈춘다.

          규격: 3열, gap 6, 4:5, rounded-lg. 여섯 장.
        */}
        {extras.photos.length > 0 ? (
          <>
            <Divider />
            <SectionTitle
              title="현장"
              note={quiet ? "지난 파티에서 찍은 것들" : "이런 분위기예요"}
              action={
                extras.photos[0]?.slug ? (
                  <More href={`/party/${extras.photos[0].slug}`} label="더 보기" />
                ) : undefined
              }
            />
            <div className="grid grid-cols-3 gap-1.5 px-4 pb-1">
              {extras.photos.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  href={`/party/${p.slug}`}
                  className="relative aspect-4/5 overflow-hidden rounded-lg bg-soft"
                >
                  <Image
                    src={p.url}
                    alt={p.caption ?? ""}
                    fill
                    sizes="(max-width: 430px) 33vw, 130px"
                    className="object-cover"
                  />
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {/*
          숫자. 팔 게 없는 날에만 보이던 것을 늘 보이게 했다. 파티가
          하나뿐인 날에도 "여기가 몇 번 열었고 몇 명이 왔나" 는 처음 온
          사람이 제일 먼저 묻는 것이다. 위의 큰 카드와 같은 칸 규격이다.
        */}
        {!quiet && totals ? (
          <>
            <Divider />
            <SectionTitle title="지금까지" note="숫자로 남겨 둔 것" />
            <div className="grid grid-cols-3 gap-2 px-4 pb-1">
              {totalTiles.map((x) => (
                <div key={x.k} className="rounded-xl bg-soft px-3 py-3">
                  <small className="text-[12px] text-sub">{x.k}</small>
                  <b className="mt-0.5 block text-[19px] font-extrabold">
                    {x.v}
                  </b>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/*
          후기. 숫자는 크기를 말하고 후기는 분위기를 말한다.

          규격: 카드 bg-soft rounded-xl p-3.5, 별 12 brand, 본문 13.5
          두 줄, 아랫줄 12 흐리게.
        */}
        {reviews.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="후기" note="다녀간 사람들이 남긴 말" />
            <div className="grid gap-2 px-4 pb-1">
              {reviews.map((r) => (
                <Link
                  key={r.id}
                  href={r.event ? `/party/${r.event.slug}` : "/explore"}
                  className="rounded-xl bg-soft p-3.5 transition active:opacity-70"
                >
                  <span className="text-[12px] tracking-[0.1em] text-brand">
                    {"★".repeat(Math.max(1, Math.min(5, r.rating)))}
                  </span>
                  <p className="clamp-2 mt-1 text-[13.5px] leading-relaxed">
                    {r.body}
                  </p>
                  <p className="mt-1.5 truncate text-[12px] text-sub">
                    {r.nickname}
                    {r.event ? ` · ${r.event.title}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {/*
          지난 파티. **파는 게 아니라 증거다.**

          처음 온 사람이 제일 궁금해하는 건 "지난번엔 어땠나" 다. 끝난
          파티를 지우면 그 답이 없어진다. 다만 예매하는 판과 섞이면
          안 되므로 작게, 아래에 둔다.
        */}
        {past.length > 0 && quiet ? (
          <>
            <Divider />
            <SectionTitle
              title="지난 파티"
              note="그날 어땠는지 사진과 숫자로 남겨 뒀어요"
            />
            {/* 팔 게 없는 날에는 이게 홈의 본문이다. 작은 줄로 흘려
                보내면 아무도 안 누른다 */}
            <div className="grid gap-4 px-4 pb-1">
              {past.slice(0, 3).map((e) => (
                <Link key={e.id} href={`/party/${e.slug}`} className="block">
                  <div className="relative aspect-[5/3] overflow-hidden rounded-card bg-soft">
                    {e.cover_url ? (
                      <Image
                        src={e.cover_url}
                        alt=""
                        fill
                        sizes="(max-width: 430px) 100vw, 398px"
                        className="object-cover grayscale-[0.3]"
                      />
                    ) : null}
                    <span className="absolute left-2.5 top-2.5 rounded bg-ink/85 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      기록
                    </span>
                  </div>
                  <div className="mt-2 text-[16px] font-extrabold">
                    {e.title}
                  </div>
                  <div className="mt-0.5 text-[13px] text-sub">
                    {shortDate(e.starts_at)} · {e.venue_name} · {e.area}
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {past.length > 0 && !quiet ? (
          <>
            <Divider />
            <SectionTitle title="지난 파티" note="어떻게 놀았는지 남겨 뒀어요" />
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-1">
              {past.map((e) => (
                <Link
                  key={e.id}
                  href={`/party/${e.slug}`}
                  className="w-[220px] flex-none"
                >
                  <div className="relative aspect-3/2 overflow-hidden rounded-xl bg-soft">
                    {e.cover_url ? (
                      <Image
                        src={e.cover_url}
                        alt=""
                        fill
                        sizes="220px"
                        className="object-cover grayscale-[0.35]"
                      />
                    ) : null}
                    <span className="absolute left-2 top-2 rounded bg-ink/85 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      기록
                    </span>
                  </div>
                  <div className="mt-2 truncate text-[14.5px] font-bold">
                    {e.title}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-sub">
                    {shortDate(e.starts_at)} · {e.area}
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {/*
          커뮤니티. 파티 사이 기간에도 글은 올라온다 — 홈에 세 줄만
          끌어다 놓으면 "여기 사람이 있다" 가 보인다.

          규격: 줄 사이 1px line, 닉네임 12.5 굵게 + 시각 흐리게,
          본문 14 두 줄, 댓글 수 12 흐리게.
        */}
        {posts.length > 0 ? (
          <>
            <Divider />
            <SectionTitle
              title="커뮤니티"
              note="요즘 올라온 글"
              action={<More href="/community" />}
            />
            <div className="mx-4 divide-y divide-line rounded-xl border border-line">
              {posts.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href={`/community/${p.id}`}
                  className="block px-3.5 py-3 transition active:bg-soft"
                >
                  <div className="flex items-baseline gap-2 text-[12.5px]">
                    <b className="truncate">{p.nickname}</b>
                    <span className="flex-none text-sub">{ago(p.created_at)}</span>
                    {p.comment_count > 0 ? (
                      <span className="ml-auto flex-none text-sub">
                        {`댓글 ${p.comment_count}`}
                      </span>
                    ) : null}
                  </div>
                  <p className="clamp-2 mt-1 text-[14px] leading-relaxed">
                    {p.body}
                  </p>
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

        {/*
          **팔 게 없는 날 홈이 모집해야 하는 건 손님이 아니라 파티다.**

          손님은 파티가 있어야 오고, 파티는 여는 사람이 있어야 생긴다.
          아래가 비어 있느니 여기서 그걸 묻는다 — 이 화면까지 내려온
          사람은 이미 이 씬에 관심이 있는 사람이다.
        */}
        {quiet ? (
          <>
            <Divider />
            <section className="px-4 py-5">
              <h4 className="text-base font-extrabold">파티를 여시나요?</h4>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
                예매·정원·성비·정산을 파티모아가 맡습니다. 여는 쪽은
                파티만 만들면 돼요.
              </p>
              <Link
                href="/my/crew-apply"
                className="mt-3 block rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold transition active:bg-soft"
              >
                호스트 신청하기
              </Link>
            </section>
          </>
        ) : null}

        <div className="h-4" />
      </div>
    </>
  );
}
