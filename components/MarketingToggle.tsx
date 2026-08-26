"use client";

import { useState, useTransition } from "react";

import { setMarketingPush } from "@/app/(guest)/my/alerts/actions";

/**
 * 광고성 알림 동의.
 *
 * **예매 알림과 한 스위치에 묶지 않는다.** 입금 확인을 받으려고 켠
 * 사람에게 광고를 보내는 건 동의를 받은 게 아니다 (정보통신망법 50조).
 *
 * 기본은 꺼짐이다. 미리 켜 두고 끄게 하는 방식은 동의로 안 쳐 준다.
 */
export function MarketingToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-4 rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <b className="text-[15px] font-extrabold">새 파티 소식 받기</b>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">
            새로 열리는 파티와 할인 소식을 보내 드려요.{" "}
            <b className="text-ink">광고성 알림</b>이라 따로 동의를 받습니다.
            안 켜도 예매 알림은 그대로 갑니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy}
          onClick={() => {
            const next = !on;
            setOn(next);
            setErr(null);
            start(async () => {
              const r = await setMarketingPush(next);
              if (!r.ok) {
                setOn(!next);
                setErr(r.message);
              }
            });
          }}
          className={`relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-brand" : "bg-[#D5D8DE]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-[left] ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <p className="mt-2.5 text-[12px] leading-relaxed text-sub">
        언제든 여기서 끌 수 있어요. 밤 9시부터 아침 8시까지는 광고를 보내지
        않습니다.
      </p>
    </div>
  );
}
