"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { deleteEvent } from "@/app/(crew)/crew/manage/actions";
import { longDate } from "@/lib/format";
import type { EventRow } from "@/types/database";

const LABEL: Record<EventRow["status"], string> = {
  draft: "작성 중",
  open: "예매 중",
  closed: "예매 마감",
  done: "종료",
};

const TONE: Record<EventRow["status"], string> = {
  draft: "bg-soft text-sub",
  open: "bg-brand-soft text-brand",
  closed: "bg-[#FFF4E5] text-[#B76E00]",
  done: "bg-soft text-sub",
};

export function EventAdminList({ events }: { events: EventRow[] }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="text-base font-extrabold">파티</h4>
        <Link href="/crew/events/new" className="text-[13px] text-brand">
          새로 등록
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="py-4 text-[13px] text-sub">아직 등록한 파티가 없어요.</p>
      ) : (
        events.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 border-b border-line py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-bold">
                  {e.title}
                </span>
                <span
                  className={`flex-none rounded px-1.5 py-0.5 text-[11px] font-bold ${TONE[e.status]}`}
                >
                  {LABEL[e.status]}
                </span>
              </div>
              <div className="mt-1 text-[12.5px] text-sub">
                {longDate(e.starts_at)} · 정원 {e.capacity}명
              </div>
            </div>
            <div className="flex flex-none items-center gap-2.5">
              <Link
                href={`/crew/events/${e.id}/edit`}
                className="text-[12.5px] font-semibold text-brand"
              >
                수정
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`${e.title} 을 지울까요?`)) return;
                  start(async () => {
                    setErr(null);
                    const r = await deleteEvent(e.id);
                    if (!r.ok) setErr(r.message);
                  });
                }}
                className="-m-2 p-2 text-[12.5px] text-sub"
              >
                삭제
              </button>
            </div>
          </div>
        ))
      )}
      {err ? (
        <p className="mt-2.5 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
    </div>
  );
}
