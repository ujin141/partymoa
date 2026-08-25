"use client";

import { useState } from "react";

/**
 * 공유. 폰에서는 OS 공유 시트가 뜨고(카톡으로 바로 넘어간다), 없으면
 * 주소를 복사한다 — 파티 링크를 단톡방에 던지는 게 이 앱의 주된 유입이다.
 */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      aria-label="공유"
      onClick={async () => {
        const url = location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, text: text || undefined, url });
            return;
          } catch {
            // 사용자가 취소한 경우다. 복사로 떨어뜨리지 않는다
            return;
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          // 클립보드를 막아 둔 브라우저가 있다
        }
      }}
      className="grid h-10 w-10 place-items-center rounded-full border border-line transition active:scale-90"
    >
      {done ? (
        <span className="text-[11px] font-bold text-brand">복사</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[17px] w-[17px] fill-none stroke-sub stroke-2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 15V3.5" />
          <path d="m8 7 4-3.5L16 7" />
          <path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />
        </svg>
      )}
    </button>
  );
}
