import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { HeroCard, PartyCard } from "@/components/PartyCard";
import { Wordmark } from "@/components/Symbol";
import { Divider, Empty, SectionTitle } from "@/components/ui/primitives";
import { listPosts } from "@/lib/community";
import { homeExtras, listAreas, listCrews, listOpenParties } from "@/lib/queries";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { GENRES, inGenre } from "@/lib/genres";

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
    posts,
    { data: profile },
    { count: unpaidCount },
  ] = await Promise.all([
    listOpenParties(),
    listCrews(),
    listAreas(),
    homeExtras(),
    listPosts(),
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
   * 취향 칸은 **실제로 좁혀 줄 때만** 띄운다. 파티가 셋인데 셋 다
   * 취향에 맞으면 그 칸은 아래 목록과 똑같고, 같은 걸 두 번 보여 주는
   * 셈이 된다.
   */
  const showLiked = liked.length > 0 && liked.length < parties.length;

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

        {/**
          * **여섯 갈래가 이 앱의 첫 갈림길이다.**
          *
          * 태그를 한 줄로 늘어놓으면 이미 뭘 찾는지 아는 사람만 쓴다.
          * 처음 온 사람은 하우스와 루프탑 중에 뭘 눌러야 자기가 갈
          * 만한 파티가 나오는지 모른다. 가는 이유로 나눈다.
          *
          * **한 칸에 두 줄 이상 넣지 않는다.** 설명과 개수까지 붙이면
          * 여섯 칸이 화면 절반을 먹고, 그러면 한눈에 보이지 않는다.
          * 그림 하나와 이름 하나면 고를 수 있다.
          *
          * 파티가 없는 갈래도 그대로 둔다. 칸이 사라졌다 나타났다 하면
          * 매번 다른 앱처럼 보인다 — 대신 흐리게 둔다.
          */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 px-4">
          {GENRES.map((g) => {
            const n = parties.filter((p) => inGenre(g, p.event)).length;
            return (
              <Link
                key={g.key}
                href={`/explore?g=${g.key}`}
                aria-label={`${g.label} — ${g.note}`}
                className={`grid place-items-center gap-1 rounded-2xl bg-soft py-3.5 transition active:scale-95 ${
                  n > 0 ? "" : "opacity-45"
                }`}
              >
                <span className="text-[21px] leading-none" aria-hidden="true">
                  {g.icon}
                </span>
                <b className="text-[12.5px] font-bold leading-none">
                  {g.label}
                </b>
              </Link>
            );
          })}
        </div>

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
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {liked.slice(0, 5).map((d) => (
                <HeroCard key={d.event.id} d={d} />
              ))}
            </div>
          </>
        ) : null}

        {upcoming.length > 0 ? (
          <>
            <SectionTitle title="다가오는 파티" note="빠른 날짜 순서" />
            {upcoming.map((d) => (
              <PartyCard key={d.event.id} d={d} />
            ))}
          </>
        ) : null}

        {/* **DJ 가 표를 판다.** 클럽 씬에서 "언제 어디" 보다 "누가 트는지"
            가 먼저다 */}
        {extras.djs.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="라인업" note="이 사람들이 틉니다" />
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
              {extras.djs.map((d) => (
                <Link
                  key={d.id}
                  href={`/party/${d.slug}`}
                  className="flex-none rounded-full border border-line px-3.5 py-2 text-[13.5px] font-bold tracking-wide transition active:scale-95"
                >
                  {d.name}
                </Link>
              ))}
            </div>
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

        {/* 파티가 없는 날에도 돌아올 이유. 목록 화면을 한 번 더 만들지
            않고 최근 세 개만 얹는다 */}
        {posts.length > 0 ? (
          <>
            <Divider />
            <SectionTitle title="커뮤니티" note="같이 갈 사람 구하거나, 후기 남기거나" />
            {posts.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                href={`/community/${p.id}`}
                className="block border-b border-line px-4 py-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold">{p.nickname}</span>
                  <span className="ml-auto text-[12.5px] text-sub">
                    {ago(p.created_at)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[14px] leading-relaxed text-sub">
                  {p.body}
                </p>
              </Link>
            ))}
            <Link
              href="/community"
              className="block px-4 py-4 text-[13.5px] font-semibold text-brand"
            >
              커뮤니티 전체 보기 ›
            </Link>
          </>
        ) : null}

        <div className="h-4" />
      </div>
    </>
  );
}
