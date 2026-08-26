"use client";

import { useState, useTransition } from "react";

import { addExpense, removeExpense } from "@/app/(crew)/crew/expense-actions";
import { won } from "@/lib/format";

export function ExpenseEditor({
  eventId,
  items,
}: {
  eventId: string;
  items: { id: string; label: string; amount: number; kind?: "expense" | "income" }[];
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  /**
   * 지출인지 수입인지. **테이블 판매처럼 티켓이 아닌 돈**을 여기 넣는다.
   * 예매 금액에 얹으면 그 손님 한 명이 30만원짜리로 보이고, 플랫폼
   * 수수료까지 붙는다 — 수수료는 티켓 금액 기준이다(사양서 3-5).
   */
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [busy, start] = useTransition();

  return (
    <>
      {items.map((x) => (
        <div
          key={x.id}
          className="flex items-center border-b border-line py-2.5"
        >
          <span className="text-[14.5px]">{x.label}</span>
          {x.kind === "income" ? (
            <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
              수입
            </span>
          ) : null}
          <span
            className={`ml-auto text-[14.5px] font-bold ${
              x.kind === "income" ? "text-brand" : ""
            }`}
          >
            {x.kind === "income" ? "+" : "−"}
            {won(x.amount)}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => start(() => void removeExpense(x.id))}
            className="-my-2 ml-1 p-2 text-[13px] text-sub"
          >
            삭제
          </button>
        </div>
      ))}

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-xl border-[1.5px] py-2.5 text-[13.5px] font-semibold ${
              kind === k
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-white text-sub"
            }`}
          >
            {k === "expense" ? "지출" : "수입 (테이블 등)"}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === "income" ? "항목 (테이블 3인)" : "항목 (대관료)"}
          className="min-w-0 flex-1 rounded-xl bg-soft p-3 text-[14.5px] outline-none"
        />
        <input
          value={amount}
          inputMode="numeric"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="금액"
          className="w-28 flex-none rounded-xl bg-soft p-3 text-[14.5px] outline-none"
        />
      </div>
      <button
        type="button"
        disabled={busy || !label.trim() || !amount}
        onClick={() =>
          start(async () => {
            await addExpense(eventId, label.trim(), Number(amount), kind);
            setLabel("");
            setAmount("");
          })
        }
        className="mt-2 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold disabled:opacity-45"
      >
        {kind === "income" ? "수입 추가" : "지출 추가"}
      </button>
    </>
  );
}
