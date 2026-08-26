"use client";

import { useState, useTransition } from "react";

import {
  approveApplication,
  rejectApplication,
} from "@/app/(admin)/admin/(dash)/applications/actions";
import { stamp } from "@/lib/format";
import type { CrewApplication } from "@/types/database";

const LABEL = {
  pending: "심사 중",
  approved: "승인",
  rejected: "반려",
} as const;

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1">
      <span className="w-[76px] flex-none text-[12.5px] text-sub">{label}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13.5px]">
        {value}
      </span>
    </div>
  );
}

/**
 * 신청 한 건.
 *
 * **승인은 되돌릴 수 없다** — 누르는 순간 크루가 생기고 그 사람이 손님
 * 명단을 볼 수 있게 된다. 그래서 크루 이름을 대고 한 번 묻는다.
 *
 * 반려에는 사유를 강제한다. 사유 없이 막으면 같은 신청이 또 들어온다.
 */
export function ApplicationCard({ app }: { app: CrewApplication }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const pending = app.status === "pending";

  return (
    <div className="border-b border-line px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[16px] font-extrabold">{app.crew_name}</b>
        <span className="rounded bg-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-sub">
          {app.slug}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
            pending
              ? "bg-brand-soft text-brand"
              : app.status === "approved"
                ? "bg-[#E7F7EF] text-ok"
                : "bg-[#FDECEF] text-hot"
          }`}
        >
          {LABEL[app.status]}
        </span>
        <span className="ml-auto text-[12.5px] text-sub">
          {stamp(app.created_at)}
        </span>
      </div>

      <div className="mt-2.5">
        <Row label="소개" value={app.bio} />
        <Row
          label="인스타"
          value={app.instagram ? `@${app.instagram}` : null}
        />
        <Row
          label="담당자"
          value={`${app.contact_name} · ${app.contact_phone} · ${app.email}`}
        />
        <Row label="장소" value={app.venue} />
        <Row label="규모" value={app.scale} />
        <Row label="이력" value={app.history} />
        <Row label="메모" value={app.note} />
        <Row label="반려 사유" value={app.reject_reason} />
      </div>

      {app.instagram ? (
        <a
          href={`https://instagram.com/${app.instagram}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[13px] text-brand underline"
        >
          인스타 열어 보기
        </a>
      ) : null}

      {msg ? (
        <p className="mt-3 rounded-lg bg-[#E7F7EF] px-3 py-2.5 text-[13px] text-ok">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mt-3 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}

      {pending && !msg ? (
        rejecting ? (
          <div className="mt-3">
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="반려 사유 — 신청자에게 그대로 보입니다"
              className="w-full rounded-xl bg-soft p-3 text-[14px] outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejecting(false);
                  setErr(null);
                }}
                className="rounded-xl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-sub"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy || reason.trim().length < 2}
                onClick={() =>
                  start(async () => {
                    setErr(null);
                    const r = await rejectApplication(app.id, reason);
                    if (!r.ok) {
                      setErr(r.message);
                      return;
                    }
                    setMsg(r.message);
                  })
                }
                className="flex-1 rounded-xl bg-hot py-2.5 text-[13.5px] font-bold text-white disabled:bg-[#C8CBD2]"
              >
                반려하기
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="rounded-xl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-sub"
            >
              반려
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  !confirm(
                    `${app.crew_name} 을 승인할까요?\n승인하면 크루가 만들어지고 ${app.email} 로 로그인한 사람이 손님 명단을 봅니다.`,
                  )
                )
                  return;
                start(async () => {
                  setErr(null);
                  const r = await approveApplication(app.id);
                  if (!r.ok) {
                    setErr(r.message);
                    return;
                  }
                  setMsg(r.message);
                });
              }}
              className="flex-1 rounded-xl bg-brand py-2.5 text-[13.5px] font-bold text-white disabled:bg-[#C8CBD2]"
            >
              {busy ? "처리 중…" : "승인"}
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
