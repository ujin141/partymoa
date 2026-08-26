import Link from "next/link";

import { Countdown, Deadline } from "@/components/Countdown";
import { CancelBooking } from "@/components/CancelBooking";
import { CopyButton } from "@/components/CopyButton";
import { FindTicket } from "@/components/FindTicket";
import { StoryShare } from "@/components/StoryShare";
import { Empty, StatusPill } from "@/components/ui/primitives";
import { longDate, won } from "@/lib/format";
import { myBookings } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 티켓" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const supabase = await createClient();
  const [{ new: fresh }, list, { data: auth }] = await Promise.all([
    searchParams,
    myBookings(),
    supabase.auth.getUser(),
  ]);
  const signedIn = Boolean(auth?.user && !auth.user.is_anonymous);

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3.5">
        <span className="text-[17px] font-extrabold">내 티켓</span>
        <span className="ml-auto text-[13px] text-sub">{list.length}건</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
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

              {/* 미입금은 손님이 직접 뺄 수 있다. 크루에게 DM 을 보내고
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
      </div>
    </>
  );
}
