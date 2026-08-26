"use client";

import Link from "next/link";

import { Countdown, Deadline } from "@/components/Countdown";
import { CopyButton } from "@/components/CopyButton";
import { won } from "@/lib/format";
import type { Booking } from "@/types/database";

/**
 * 예매 완료 화면.
 *
 * **여기가 이 앱에서 제일 중요한 화면일지도 모른다.** 신청까지는 잘 해 놓고
 * 입금을 안 하면 24시간 뒤 자리가 날아간다. 그러니 이 화면은 딱 세 가지만
 * 말한다 — 얼마를, 어디로, 언제까지.
 *
 * 예전에는 신청하면 티켓 목록으로 넘겼는데, 목록에서는 이 세 가지가
 * 카드 하나로 눌려 보여서 그냥 지나쳤다.
 */
export function BookingDone({
  booking,
  eventTitle,
  bankAccount,
}: {
  booking: Booking;
  eventTitle: string;
  bankAccount: string | null;
}) {
  const payer = `${booking.code} ${booking.name}`;

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
      <div className="py-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 fill-none stroke-brand stroke-[2.5]"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 className="mt-3.5 text-[20px] font-extrabold">신청됐어요</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-sub">
          아직 확정은 아니에요. 입금까지 마쳐야 자리가 잡힙니다.
        </p>
      </div>

      <div className="rounded-card border border-line">
        <div className="flex items-end justify-between border-b border-dashed border-line px-4 py-3.5">
          <div>
            <small className="text-[12.5px] text-sub">예매번호</small>
            <div className="text-2xl font-extrabold">{booking.code}</div>
          </div>
          <div className="text-right">
            <small className="text-[12.5px] text-sub">입금할 금액</small>
            <div className="text-lg font-extrabold">{won(booking.amount)}</div>
          </div>
        </div>
        <p className="px-4 py-3 text-[13.5px] text-sub">
          {eventTitle} · {booking.quantity}명
        </p>
      </div>

      {/* 1. 어디로 */}
      {bankAccount ? (
        <div className="mt-3 rounded-card bg-soft p-4">
          <small className="text-[12.5px] text-sub">1. 이 계좌로 보내세요</small>
          <div className="mt-1 flex items-center gap-2">
            <b className="min-w-0 flex-1 truncate text-[16px] font-extrabold">
              {bankAccount}
            </b>
            <CopyButton text={bankAccount} label="복사" />
          </div>
        </div>
      ) : null}

      {/* 2. 어떤 이름으로 — 여기서 틀리면 호스트가 손으로 찾아야 한다 */}
      <div className="mt-2.5 rounded-card bg-soft p-4">
        <small className="text-[12.5px] text-sub">
          2. 입금자명을 이렇게 적어 주세요
        </small>
        <div className="mt-1 flex items-center gap-2">
          <b className="min-w-0 flex-1 truncate text-[16px] font-extrabold">
            {payer}
          </b>
          <CopyButton text={payer} label="복사" />
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
          이름만 넣으면 같은 이름이 여럿이라 확인이 늦어져요.
        </p>
      </div>

      {/* 3. 언제까지 */}
      <div className="mt-2.5 rounded-card border border-hot/30 bg-hot/5 p-4">
        <small className="text-[12.5px] text-sub">3. 입금 마감</small>
        <div className="mt-1 text-[16px] font-extrabold text-hot">
          <Deadline at={booking.expires_at} />
        </div>
        <p className="mt-1 text-[13px] font-semibold text-hot">
          <Countdown until={booking.expires_at} />
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
          이때까지 입금이 없으면 자동 취소되고 자리가 다음 사람에게 넘어가요.
        </p>
      </div>

      <Link
        href="/tickets"
        className="mt-5 block rounded-xl bg-brand py-3.5 text-center text-[15px] font-bold text-white"
      >
        내 티켓에서 다시 보기
      </Link>
      <p className="mt-3 text-center text-[12.5px] leading-relaxed text-sub">
        이 화면을 닫아도 <b className="text-ink">{booking.code}</b> 와 연락처로
        다시 찾을 수 있어요.
      </p>
    </div>
  );
}
