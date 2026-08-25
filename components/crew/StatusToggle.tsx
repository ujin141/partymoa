"use client";

import { useTransition } from "react";

import { setEventStatus } from "@/app/(crew)/crew/actions";
import type { EventStatus } from "@/types/database";

const STEPS: { value: EventStatus; label: string; note: string }[] = [
  { value: "draft", label: "작성 중", note: "게스트에게 안 보여요" },
  { value: "open", label: "예매 중", note: "링크로 예매를 받아요" },
  { value: "closed", label: "예매 마감", note: "보이지만 신청은 못 해요" },
  { value: "done", label: "종료", note: "행사가 끝났어요" },
];

export function StatusToggle({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const [busy, start] = useTransition();
  return (
    <div className="grid grid-cols-2 gap-2">
      {STEPS.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={busy || s.value === status}
          onClick={() => start(() => void setEventStatus(eventId, s.value))}
          className={`rounded-xl border-[1.5px] px-3 py-3 text-left ${
            s.value === status
              ? "border-brand bg-brand-soft"
              : "border-line bg-white"
          }`}
        >
          <span
            className={`block text-[14.5px] font-bold ${
              s.value === status ? "text-brand" : ""
            }`}
          >
            {s.label}
          </span>
          <span className="mt-0.5 block text-[12px] text-sub">{s.note}</span>
        </button>
      ))}
    </div>
  );
}
