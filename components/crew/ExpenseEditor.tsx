"use client";

import { useState, useTransition } from "react";

import { addExpense, removeExpense } from "@/app/(crew)/crew/expense-actions";
import { won } from "@/lib/format";

export function ExpenseEditor({
  eventId,
  items,
}: {
  eventId: string;
  items: { id: string; label: string; amount: number }[];
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, start] = useTransition();

  return (
    <>
      {items.map((x) => (
        <div
          key={x.id}
          className="flex items-center border-b border-line py-2.5"
        >
          <span className="text-[14.5px]">{x.label}</span>
          <span className="ml-auto text-[14.5px] font-bold">
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

      <div className="mt-3 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="항목 (대관료)"
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
            await addExpense(eventId, label.trim(), Number(amount));
            setLabel("");
            setAmount("");
          })
        }
        className="mt-2 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold disabled:opacity-45"
      >
        지출 추가
      </button>
    </>
  );
}
