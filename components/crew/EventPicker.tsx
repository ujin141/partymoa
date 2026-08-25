"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { EventRow } from "@/types/database";

const LABEL = {
  draft: "작성 중",
  open: "예매 중",
  closed: "예매 마감",
  done: "종료",
} as const;

export function EventPicker({
  events,
  current,
}: {
  events: EventRow[];
  current: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  if (events.length <= 1) return null;

  return (
    <div className="border-b border-line px-4 py-2.5">
      <select
        value={current}
        onChange={(e) => {
          // 크루 선택(?c=)은 그대로 두고 행사만 바꾼다
          const next = new URLSearchParams(sp);
          next.set("e", e.target.value);
          router.push(`${path}?${next.toString()}`);
        }}
        className="w-full rounded-lg bg-soft px-3 py-2.5 text-[14px] font-semibold"
      >
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title} · {LABEL[ev.status]}
          </option>
        ))}
      </select>
    </div>
  );
}
