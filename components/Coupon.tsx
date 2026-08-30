"use client";

import { useState, useTransition } from "react";

import { redeemPerk } from "@/app/(guest)/tickets/actions";
import { longDate, stamp } from "@/lib/format";
import type { BookingPerk, EventPerk, EventRow } from "@/types/database";

/**
 * 쿠폰 한 장.
 *
 * **손님이 직원 앞에서 누른다.** 직원이 손님 폰을 받아 누르게 하면 줄이
 * 두 배로 길어지고, 손님이 미리 눌러 두면 바에서 증명할 게 없어진다.
 * 그래서 누르기 전에 한 번 묻고, 누른 뒤에는 방금 눌렀다는 표시가
 * 화면에 남는다 — 직원이 보는 건 그 표시다.
 *
 * 되돌리기는 없다. 잘못 눌렀으면 크루가 푼다.
 */
export function Coupon({
  row,
  perk,
  event,
  who,
}: {
  row: BookingPerk;
  perk: EventPerk;
  event: EventRow;
  /** 예매자 이름. 바에서 대조한다 */
  who: string;
}) {
  const [used, setUsed] = useState(row.used);
  const [just, setJust] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const left = row.total - used;
  const gone = left <= 0;
  const over = new Date(event.ends_at).getTime() < Date.now() - 12 * 3600_000;

  return (
    <article
      className={`mb-3.5 overflow-hidden rounded-card border ${
        gone || over ? "border-line opacity-60" : "border-brand/35"
      }`}
    >
      <div className={`px-4 py-4 ${gone || over ? "" : "bg-brand-soft/45"}`}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                gone
                  ? "bg-soft text-sub"
                  : over
                    ? "bg-soft text-sub"
                    : "bg-brand text-white"
              }`}
            >
              {gone ? "다 씀" : over ? "기간 지남" : "사용 가능"}
            </span>
            <h3 className="mt-2 text-[17px] font-extrabold">{perk.name}</h3>
            {perk.note ? (
              <p className="mt-1 text-[13px] leading-relaxed text-sub">
                {perk.note}
              </p>
            ) : null}
          </div>
          {/* 남은 장수가 이 카드의 전부다. 제일 크게 둔다 */}
          <div className="flex-none text-right">
            <b
              className={`block text-[30px] font-extrabold leading-none ${
                gone || over ? "text-[#B0B4BC]" : "text-brand"
              }`}
            >
              {left}
            </b>
            <small className="text-[12px] text-sub">{`/ ${row.total}`}</small>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-line px-4 py-3 text-[12.5px] leading-relaxed text-sub">
        {event.title}
        <br />
        {longDate(event.starts_at)} · {event.venue_name} · {who}
        {row.last_used_at ? (
          <>
            <br />
            {`마지막 사용 ${stamp(row.last_used_at)}`}
          </>
        ) : null}
      </div>

      {just ? (
        // 직원이 보는 화면. 새로 고쳐도 안 남는 게 맞다 — 지금 눌렀다는
        // 뜻이지 쿠폰의 상태가 아니다
        <p className="border-t border-line bg-brand px-4 py-3.5 text-center text-[14.5px] font-extrabold text-white">
          방금 1장 사용했어요 · {left}장 남음
        </p>
      ) : null}

      {!gone && !over ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              !confirm(
                `${perk.name} 1장을 쓸까요?\n\n직원 앞에서 눌러 주세요. 누르면 되돌릴 수 없어요.`,
              )
            )
              return;
            start(async () => {
              setErr(null);
              const r = await redeemPerk(row.id);
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setUsed((n) => n + 1);
              setJust(true);
            });
          }}
          className="w-full border-t border-line py-3.5 text-center text-[15px] font-extrabold text-brand disabled:opacity-50"
        >
          {busy ? "쓰는 중…" : "사용하기"}
        </button>
      ) : null}

      {err ? (
        <p className="border-t border-line px-4 py-2.5 text-[12.5px] font-semibold text-hot">
          {err}
        </p>
      ) : null}
    </article>
  );
}
