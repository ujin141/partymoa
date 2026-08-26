"use client";

import { useState, useTransition } from "react";

import { cancelMyBooking } from "@/app/(guest)/tickets/actions";

/**
 * 예매 취소.
 *
 * **미입금일 때만 보여 준다.** 입금한 건은 환불이 얽혀 있어 크루가
 * 처리해야 하는데, 버튼을 띄워 놓고 눌렀을 때 막으면 다 눌러 본 뒤에
 * 안 된다는 말을 듣게 된다.
 *
 * 두 번 묻는다. 자리를 놓는 일이라 되돌릴 수 없다 — 다시 예매하면
 * 그 사이에 남이 가져갔을 수 있다.
 */
export function CancelBooking({
  bookingId,
  eventTitle,
}: {
  bookingId: string;
  eventTitle: string;
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            !confirm(
              `${eventTitle} 예매를 취소할까요?\n자리가 바로 풀리고, 다시 예매할 때는 그 사이에 남이 가져갔을 수 있어요.`,
            )
          )
            return;
          start(async () => {
            setErr(null);
            const r = await cancelMyBooking(bookingId);
            if (!r.ok) setErr(r.message);
          });
        }}
        className="w-full border-t border-line py-3 text-center text-[13.5px] font-semibold text-sub disabled:opacity-50"
      >
        {busy ? "취소하는 중…" : "예매 취소"}
      </button>
      {err ? (
        <p className="border-t border-line px-4 py-2.5 text-[12.5px] font-semibold text-hot">
          {err}
        </p>
      ) : null}
    </>
  );
}
