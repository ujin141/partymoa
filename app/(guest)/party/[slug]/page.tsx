import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingSheet } from "@/components/BookingSheet";
import { PhotoStrip } from "@/components/PhotoStrip";
import { Reviews } from "@/components/Reviews";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { Gauge, Tag } from "@/components/ui/primitives";
import { longDate, timeRange, won } from "@/lib/format";
import { getParty } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { genderCap, priceFor, soldRate } from "@/lib/rules";
import type { EventPhoto, EventTable, Review } from "@/types/database";

// **캐시를 안 쓴다.** 찜은 사람마다 다르고 잔여는 초 단위로 바뀐다.
// revalidate 를 걸어 두면 남의 찜과 지난 잔여가 그대로 나간다
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getParty(slug);
  if (!d) return { title: "파티모아" };
  return {
    title: d.event.title,
    description: d.event.subtitle ?? undefined,
    // images 를 여기서 지정하지 않는다. 같은 폴더의 opengraph-image.tsx 가
    // 커버 사진 위에 날짜·장소·잔여를 얹은 카드를 만든다 —
    // 여기에 cover_url 을 넣으면 그 카드를 덮어써서 사진만 나간다
    openGraph: {
      title: d.event.title,
      description: d.event.subtitle ?? undefined,
    },
  };
}

export default async function PartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /** `?i=CODE` — 크루 멤버 초대 링크 */
  searchParams: Promise<{ i?: string }>;
}) {
  const { slug } = await params;
  const d = await getParty(slug);
  if (!d || (d.event.status !== "open" && d.event.status !== "closed")) {
    notFound();
  }

  const { event, stats, tiers, lineups, tierSold, tier } = d;

  // 후기. 자격 판정은 DB 의 can_review() 가 한다 — 여기서 다시 세면
  // 두 군데가 어긋난다
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user && !user.is_anonymous);

  const [{ data: reviewRows }, { data: canWrite }, { data: profile }] =
    await Promise.all([
      supabase
        .from("reviews")
        .select("*")
        .eq("event_id", event.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      signedIn
        ? supabase.rpc("can_review", { p_event: event.id })
        : Promise.resolve({ data: false }),
      signedIn
        ? supabase
            .from("profiles")
            .select("nickname, real_name, phone")
            .eq("user_id", user!.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const reviews = (reviewRows ?? []) as Review[];

  // 테이블 예약. 차수와 다른 것이라 따로 읽는다
  const { data: tableRows } = await supabase
    .from("event_tables")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order");
  const tables = (tableRows ?? []) as EventTable[];

  const { data: photoRows } = await supabase
    .from("event_photos")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order");
  const photos = (photoRows ?? []) as EventPhoto[];
  const mine = reviews.some((r) => r.user_id === user?.id);
  const me = profile as {
    nickname: string | null;
    real_name: string | null;
    phone: string | null;
  } | null;
  const cap = genderCap(event.capacity);
  const leftF = event.gender_balanced
    ? Math.max(0, cap - stats.booked_f)
    : Math.max(0, event.capacity - stats.booked);
  const leftM = event.gender_balanced
    ? Math.max(0, cap - stats.booked_m)
    : Math.max(0, event.capacity - stats.booked);
  const pct = soldRate(stats.booked, stats.capacity);
  const soldOut = stats.booked >= stats.capacity || !tier;

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">파티 상세</span>
        <span className="ml-auto flex items-center gap-1.5">
          <ShareButton title={event.title} text={event.subtitle ?? ""} />
          <FavoriteButton
            eventId={event.id}
            on={d.favorited}
            variant="plain"
          />
        </span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="relative aspect-[5/3.4] bg-soft">
          {event.cover_url ? (
            <Image
              src={event.cover_url}
              alt=""
              fill
              sizes="430px"
              priority
              className="object-cover"
            />
          ) : null}
        </div>

        <section className="border-b-8 border-soft px-4 py-4.5">
          <p className="text-[13px] font-semibold text-brand">{d.crew.name}</p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-snug">
            {event.title}
          </h1>
          {event.subtitle ? (
            <p className="mt-2 text-[14.5px] text-sub">{event.subtitle}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {event.solo_friendly ? <Tag tone="solo">1인 참여 환영</Tag> : null}
            {event.genres.map((g) => (
              <Tag key={g}>{g}</Tag>
            ))}
            {event.categories.map((c) => (
              <Tag key={c}>{c}</Tag>
            ))}
          </div>
        </section>

        {event.description ? (
          <section className="border-b-8 border-soft px-4 py-4.5">
            <p className="whitespace-pre-wrap text-[14.5px] leading-7 text-ink">
              {event.description}
            </p>
          </section>
        ) : null}

        <section className="border-b-8 border-soft px-4 py-4.5">
          <dl className="grid grid-cols-[58px_1fr] gap-x-3 gap-y-2.5 text-[14.5px]">
            <dt className="text-[13.5px] text-sub">일시</dt>
            <dd className="m-0 leading-relaxed">
              {longDate(event.starts_at)}
              <br />
              {timeRange(event.starts_at, event.ends_at)}
            </dd>
            <dt className="text-[13.5px] text-sub">장소</dt>
            <dd className="m-0 leading-relaxed">
              {event.venue_name} · {event.area}
              {event.address ? (
                <span className="block text-[13px] text-sub">
                  {event.address}
                </span>
              ) : null}
            </dd>
            <dt className="text-[13.5px] text-sub">주최</dt>
            <dd className="m-0">
              {d.crew.name}
              {/* 환불·문의는 크루가 받는다. 연락할 길을 여기 둔다 */}
              {d.crew.instagram ? (
                <a
                  href={`https://instagram.com/${d.crew.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1.5 text-[13px] text-brand underline"
                >
                  {`@${d.crew.instagram}`}
                </a>
              ) : null}
            </dd>
            <dt className="text-[13.5px] text-sub">정원</dt>
            <dd className="m-0">{event.capacity}명</dd>
          </dl>
        </section>

        <section className="border-b-8 border-soft px-4 py-4.5">
          <h4 className="mb-3 text-base font-extrabold">예매 현황</h4>
          <Gauge pct={pct} tone={pct >= 70 ? "hot" : "brand"} />
          <div className="mt-2.5 flex justify-between text-[13px] text-sub">
            <span>
              예매 <b className="text-ink">{stats.booked}명</b> /{" "}
              {stats.capacity}
            </span>
            <span>
              잔여{" "}
              <b className="text-ink">
                {Math.max(0, stats.capacity - stats.booked)}자리
              </b>
            </span>
          </div>
          {event.gender_balanced ? (
            <>
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-soft px-3.5 py-3">
                  <small className="text-[12.5px] text-sub">여성 잔여</small>
                  <b
                    className={`mt-0.5 block text-[19px] font-extrabold ${
                      leftF === 0 ? "text-[#B0B4BC]" : ""
                    }`}
                  >
                    {leftF === 0 ? "마감" : `${leftF}자리`}
                  </b>
                </div>
                <div className="rounded-xl bg-soft px-3.5 py-3">
                  <small className="text-[12.5px] text-sub">남성 잔여</small>
                  <b
                    className={`mt-0.5 block text-[19px] font-extrabold ${
                      leftM === 0 ? "text-[#B0B4BC]" : ""
                    }`}
                  >
                    {leftM === 0 ? "마감" : `${leftM}자리`}
                  </b>
                </div>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-sub">
                성비를 맞추려고 남녀 각각 {cap}명까지 받아요. 한쪽이 마감되면
                그 성별 예매가 닫힙니다.
              </p>
            </>
          ) : null}
        </section>

        {/* 남녀 가격이 다르다. 여성가만 보여 주면 남자는 결제 직전에야
            다른 값을 본다 — 차수마다 두 값을 다 편다 */}
        <section className="border-b-8 border-soft px-4 py-4.5">
          <h4 className="mb-3 text-base font-extrabold">가격</h4>
          {tiers.map((t) => {
            const sold = tierSold[t.id] ?? 0;
            const out = sold >= t.capacity;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 border-b border-line py-2.5 last:border-b-0 ${
                  out ? "text-[#B4B8C2]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{t.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-sub">
                    {out
                      ? "매진"
                      : `${Math.max(0, t.capacity - sold)}장 남음${t.note ? ` · ${t.note}` : ""}`}
                  </div>
                </div>
                <div className="flex-none text-right text-[13.5px] leading-6">
                  <div>
                    <span className="text-sub">여 </span>
                    <b>{won(t.price)}</b>
                  </div>
                  <div>
                    <span className="text-sub">남 </span>
                    <b>
                      {won(
                        priceFor(
                          t.price,
                          "M",
                          Number(event.male_price_multiplier),
                          t.male_price,
                        ),
                      )}
                    </b>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <PhotoStrip photos={photos} />

        {/* 테이블은 차수와 다른 물건이다 — **잡으면 입장비가 없다.**
            가격 옆에 붙여야 "입장권을 살까 테이블을 잡을까" 를 그 자리에서
            비교한다. 아래로 내리면 이미 예매를 누른 뒤에 보게 된다 */}
        {tables.length > 0 ? (
          <section className="border-b-8 border-soft px-4 py-4.5">
            <h4 className="mb-1 text-base font-extrabold">테이블</h4>
            <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
              테이블을 잡으면 <b className="text-ink">입장비가 없습니다.</b>{" "}
              적힌 인원까지 그대로 들어와요.
            </p>
            {tables.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 border-b border-line py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <b className="text-[15px] font-extrabold">{t.name}</b>
                    <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                      {`${t.seats}인 입장 무료`}
                    </span>
                  </div>
                  {t.note ? (
                    <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-sub">
                      {t.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex-none text-right">
                  <b className="block text-[15px] font-extrabold">
                    {won(t.price)}
                  </b>
                  {t.card_price ? (
                    <span className="mt-0.5 block text-[11.5px] text-sub">
                      {`카드 ${t.card_price.toLocaleString("ko-KR")}`}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {event.tables_note ? (
              <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-soft p-3.5 text-[12.5px] leading-6 text-sub">
                {event.tables_note}
              </p>
            ) : null}

            <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
              테이블은 앱에서 결제하지 않습니다.{" "}
              {d.crew.instagram ? (
                <a
                  href={`https://instagram.com/${d.crew.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline"
                >
                  {`@${d.crew.instagram}`}
                </a>
              ) : (
                "주최 크루"
              )}{" "}
              로 문의해 주세요.
            </p>
          </section>
        ) : null}

        {lineups.length > 0 ? (
          <section className="border-b-8 border-soft px-4 py-4.5">
            <h4 className="mb-3 text-base font-extrabold">라인업</h4>
            {lineups.map((l, i) => (
              <div
                key={l.id}
                className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
              >
                <span className="w-12 flex-none text-[13px] text-sub">
                  {l.starts_at.slice(0, 5)}
                </span>
                <span className="text-[15.5px] font-bold">{l.artist_name}</span>
                {i === 0 ? (
                  <span className="ml-auto rounded-md bg-brand-soft px-1.5 py-0.5 text-[11.5px] font-bold text-brand">
                    오프닝
                  </span>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        <Reviews
          eventId={event.id}
          slug={event.slug}
          reviews={reviews}
          canWrite={Boolean(canWrite)}
          mine={mine}
          defaultNickname={me?.nickname ?? ""}
          started={new Date(event.starts_at) <= new Date()}
        />

        <section className="px-4 py-4.5">
          <div className="rounded-xl bg-soft p-3.5 text-[13.5px] leading-7 text-sub">
            신청 후 24시간 안에 입금하지 않으면 자동 취소되고 자리가 다음
            사람에게 넘어가요.
            <br />
            입금자명은 <b className="text-ink">예매번호 + 이름</b>으로 넣어
            주세요.
            <br />
            환불·문의는 주최 크루에 직접 연락해 주세요.
          </div>
        </section>
        <div className="h-4" />
      </div>

      <BookingSheet
        eventId={event.id}
        eventTitle={event.title}
        capacity={event.capacity}
        genderBalanced={event.gender_balanced}
        maleMultiplier={Number(event.male_price_multiplier)}
        tiers={tiers}
        tierSold={tierSold}
        bookedF={stats.booked_f}
        bookedM={stats.booked_m}
        booked={stats.booked}
        soldOut={soldOut}
        closed={event.status !== "open"}
        currentTierName={tier?.name ?? null}
        currentPrice={
          tier ? priceFor(tier.price, "F", Number(event.male_price_multiplier)) : null
        }
        invite={(await searchParams).i ?? null}
        defaultName={me?.real_name ?? null}
        defaultPhone={me?.phone ?? null}
        bankAccount={event.bank_account}
      />
    </>
  );
}
