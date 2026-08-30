import Link from "next/link";

import { Countdown, Deadline } from "@/components/Countdown";
import { CancelBooking } from "@/components/CancelBooking";
import { CopyButton } from "@/components/CopyButton";
import { Coupon } from "@/components/Coupon";
import { FindTicket } from "@/components/FindTicket";
import { OfflineTicket } from "@/components/OfflineTicket";
import { StoryShare } from "@/components/StoryShare";
import { Empty, StatusPill } from "@/components/ui/primitives";
import { longDate, stamp, won } from "@/lib/format";
import { REFUND_CUTOFF_DAYS, refundOpen } from "@/lib/rules";
import { myBookings, myPerks } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 티켓" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; t?: string }>;
}) {
  const supabase = await createClient();
  const [{ new: fresh, t }, list, perks, { data: auth }] = await Promise.all([
    searchParams,
    myBookings(),
    myPerks(),
    supabase.auth.getUser(),
  ]);
  const signedIn = Boolean(auth?.user && !auth.user.is_anonymous);

  /**
   * **입장권과 쿠폰을 갈라 둔다.**
   *
   * 입장은 예매 한 건에 한 장이고 쿠폰은 인원수만큼이다. 한 줄로 섞으면
   * 바 앞에서 드링크가 몇 잔 남았는지를 예매 목록에서 뒤지게 된다.
   * 입구와 바는 다른 자리이고 다른 순간이다.
   */
  const tab = t === "coupon" ? "coupon" : "ticket";

  // 쓸 수 있는 것이 위로. 다 쓴 쿠폰도 남긴다 — 몇 잔 마셨는지가
  // 바와의 정산에서 근거가 된다
  const coupons = [...perks].sort((a, z) => {
    const live = (x: typeof a) =>
      x.used < x.total &&
      new Date(x.booking.event.ends_at).getTime() > Date.now() - 12 * 3600_000;
    if (live(a) !== live(z)) return live(a) ? -1 : 1;
    return (
      new Date(a.booking.event.starts_at).getTime() -
      new Date(z.booking.event.starts_at).getTime()
    );
  });
  const liveCount = coupons.filter(
    (c) =>
      c.used < c.total &&
      new Date(c.booking.event.ends_at).getTime() > Date.now() - 12 * 3600_000,
  ).length;

  /**
   * 입구에서 신호가 죽어도 보여야 하는 **한 장**.
   * 가장 먼저 열리는 파티다 — 지난 것은 입구에서 쓸 일이 없다.
   */
  const next = [...list]
    .filter((b) => new Date(b.event.starts_at).getTime() > Date.now() - 6 * 3600_000)
    .sort(
      (a, z) =>
        new Date(a.event.starts_at).getTime() -
        new Date(z.event.starts_at).getTime(),
    )[0];

  return (
    <>
      <OfflineTicket
        ticket={
          next
            ? {
                code: next.code,
                eventTitle: next.event.title,
                when: `${longDate(next.event.starts_at)} ${stamp(next.event.starts_at)}`,
                place: next.event.venue_name,
                status: next.status === "paid" ? "입금 완료" : "입금 대기",
              }
            : null
        }
      />
      <header className="flex-none border-b border-line">
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
          <span className="text-[17px] font-extrabold">내 티켓</span>
        </div>
        {/* 입구에서 쓰는 것과 바에서 쓰는 것. 같은 화면에 두되 줄을 나눈다 */}
        <div className="flex px-4">
          {[
            { key: "ticket", label: "입장권", n: list.length, href: "/tickets" },
            {
              key: "coupon",
              label: "쿠폰",
              n: liveCount,
              href: "/tickets?t=coupon",
            },
          ].map((x) => (
            <Link
              key={x.key}
              href={x.href}
              scroll={false}
              className={`-mb-px border-b-2 px-3.5 pb-2.5 text-[15px] font-bold ${
                tab === x.key
                  ? "border-ink text-ink"
                  : "border-transparent text-sub"
              }`}
            >
              {x.label}
              {x.n > 0 ? (
                <span
                  className={`ml-1 text-[13px] ${
                    tab === x.key ? "text-brand" : "text-sub"
                  }`}
                >
                  {x.n}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        {tab === "coupon" ? (
          coupons.length === 0 ? (
            <Empty>
              아직 받은 쿠폰이 없어요.
              <br />
              웰컴 드링크 같은 건 입금이 확인되면 여기로 들어와요.
            </Empty>
          ) : (
            <>
              <p className="mb-3.5 rounded-xl bg-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-sub">
                <b className="text-ink">직원 앞에서 눌러 주세요.</b> 미리
                누르면 쓴 걸로 처리돼요. 잘못 눌렀다면 크루에게 말씀해
                주세요.
              </p>
              {coupons.map((c) => (
                <Coupon
                  key={c.id}
                  row={c}
                  perk={c.perk}
                  event={c.booking.event}
                  who={c.booking.name}
                />
              ))}
            </>
          )
        ) : (
        <>
        {fresh ? (
          <div className="mb-4 rounded-xl bg-brand-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-brand">
            <b>{fresh}</b> 예매를 받았어요. 24시간 안에 입금하면 확정됩니다.
          </div>
        ) : null}

        {list.length === 0 ? (
          <>
            <Empty>
              아직 예매한 파티가 없어요.
              <br />
              다른 기기에서 예매했다면 아래에서 찾을 수 있어요.
            </Empty>
            <FindTicket />
          </>
        ) : (
          list.map((b) => (
            <article
              key={b.id}
              className="mb-3.5 overflow-hidden rounded-card border border-line"
            >
              <div className="px-4 py-4">
                <StatusPill status={b.status} />
                <h3 className="mt-2 text-[17px] font-extrabold">
                  {b.event.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
                  {longDate(b.event.starts_at)} · {b.event.venue_name}
                  <br />
                  {b.tier?.name} · {b.quantity}명 · {b.name}
                </p>
              </div>

              <div className="flex items-end justify-between border-t border-dashed border-line bg-soft px-4 py-3.5">
                <div>
                  <small className="text-[12.5px] text-sub">예매번호</small>
                  <div className="text-2xl font-extrabold">{b.code}</div>
                </div>
                <div className="text-right">
                  <small className="text-[12.5px] text-sub">결제금액</small>
                  <div className="text-lg font-extrabold">{won(b.amount)}</div>
                </div>
              </div>

              {b.status === "pending" && b.event.bank_account ? (
                <div className="border-t border-line px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <small className="text-[12.5px] text-sub">입금 계좌</small>
                      <div className="truncate text-[15px] font-bold">
                        {b.event.bank_account}
                      </div>
                    </div>
                    <CopyButton
                      text={b.event.bank_account}
                      label="계좌 복사"
                    />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <small className="text-[12.5px] text-sub">입금자명</small>
                      <div className="truncate text-[15px] font-bold">
                        {b.code} {b.name}
                      </div>
                    </div>
                    <CopyButton
                      text={`${b.code} ${b.name}`}
                      label="이름 복사"
                    />
                  </div>
                  <p className="mt-2.5 rounded-lg bg-hot/5 px-3 py-2 text-[12.5px] leading-relaxed text-hot">
                    <b>
                      <Deadline at={b.expires_at} />
                    </b>{" "}
                    까지 · <Countdown until={b.expires_at} />
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
                    이름만 넣으면 같은 이름이 여럿이라 확인이 늦어져요.
                  </p>
                </div>
              ) : null}

              {/* 입금한 건은 손님이 못 뺀다. 그러면 최소한 **환불이
                  되는 기간인지**는 그 자리에서 알려 줘야 한다 */}
              {b.status === "paid" ? (
                <p className="border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-sub">
                  {refundOpen(b.event.starts_at)
                    ? `파티 ${REFUND_CUTOFF_DAYS}일 전까지 취소하면 호스트 기준에 따라 환불됩니다. 호스트로 문의해 주세요.`
                    : `환불 불가 기간이에요. 파티 ${REFUND_CUTOFF_DAYS}일 전부터는 환불되지 않습니다.`}
                </p>
              ) : null}

              {/* 미입금은 손님이 직접 뺄 수 있다. 호스트에게 DM 을 보내고
                  기다리는 동안 그 자리가 잠겨 있는 게 제일 아깝다 */}
              {b.status === "pending" ? (
                <CancelBooking bookingId={b.id} eventTitle={b.event.title} />
              ) : null}

              {/* 익명 세션은 공유가 안 된다. 이미지 라우트가 로그인한
                  사람의 예매만 찾기 때문 — 남의 티켓이 나오면 안 된다 */}
              {signedIn ? (
                <StoryShare code={b.code} title={b.event.title} />
              ) : null}

              {/* 끝난 파티에는 후기 입구를 둔다. 파티 상세를 다시 찾아
                  들어가는 사람은 거의 없다 — 티켓이 남아 있는 여기가
                  후기를 쓸 유일한 길목이다 */}
              {new Date(b.event.starts_at) <= new Date() ? (
                <Link
                  href={`/party/${b.event.slug}#후기`}
                  className="block border-t border-line px-4 py-3 text-center text-[14px] font-semibold text-brand"
                >
                  후기 남기기
                </Link>
              ) : null}
            </article>
          ))
        )}
        {list.length > 0 ? <FindTicket /> : null}
        </>
        )}
      </div>
    </>
  );
}
