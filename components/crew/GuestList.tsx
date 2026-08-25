"use client";

import { useMemo, useState, useTransition } from "react";

import { setPaid } from "@/app/(crew)/crew/actions";
import { won } from "@/lib/format";
import type { Booking, TicketTier } from "@/types/database";

const FILTERS = ["전체", "미입금", "입금완료", "입장완료", "1인"] as const;
type Filter = (typeof FILTERS)[number];

function csvDownload(
  rows: Booking[],
  tierName: (id: string) => string,
  fileName: string,
) {
  const head = [
    "예매번호",
    "이름",
    "연락처",
    "성별",
    "인원",
    "차수",
    "금액",
    "초대코드",
    "입금",
    "입장",
    "신청일시",
  ];
  const body = rows.map((b) => [
    b.code,
    b.name,
    b.phone,
    b.gender === "F" ? "여" : "남",
    b.quantity,
    tierName(b.tier_id),
    b.amount,
    b.invite_code ?? "",
    b.status === "pending" ? "대기" : "완료",
    b.status === "checked_in" ? "완료" : "",
    new Date(b.created_at).toLocaleString("ko-KR"),
  ]);
  // **BOM 을 반드시 붙인다.** 없으면 엑셀에서 한글이 깨진다
  const text =
    "﻿" +
    [head, ...body]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function GuestList({
  bookings,
  tiers,
  eventTitle,
  bankAccount,
}: {
  bookings: Booking[];
  tiers: TicketTier[];
  eventTitle: string;
  bankAccount: string | null;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("전체");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const tierName = (id: string) =>
    tiers.find((t) => t.id === id)?.name ?? "";

  const rows = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((b) => {
      if (
        needle &&
        !`${b.name}${b.phone}${b.code}${b.invite_code ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      if (filter === "미입금") return b.status === "pending";
      if (filter === "입금완료") return b.status === "paid";
      if (filter === "입장완료") return b.status === "checked_in";
      if (filter === "1인") return b.quantity === 1;
      return true;
    });
  }, [rows, q, filter]);

  const heads = rows.reduce((a, b) => a + b.quantity, 0);
  const unpaid = rows.filter((b) => b.status === "pending");

  /**
   * 미입금 독촉. 연락처를 한 줄씩 옮겨 적는 게 제일 시간을 잡아먹는다.
   * 번호만 모아 주면 문자 앱에 그대로 붙일 수 있다.
   */
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // 클립보드를 막아 둔 브라우저가 있다
    }
  };

  return (
    <>
      <div className="flex items-baseline justify-between px-4 pb-3 pt-5">
        <h2 className="text-[19px] font-extrabold">명단</h2>
        <span className="text-[13px] text-sub">
          {rows.length}건 · {heads}명
        </span>
      </div>

      <div className="px-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름, 연락처, 예매번호 검색"
          className="w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none"
        />
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-none rounded-full border px-3.5 py-2 text-[13px] ${
              f === filter
                ? "border-ink bg-ink font-semibold text-white"
                : "border-line bg-white text-sub"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filter === "미입금" && unpaid.length > 0 ? (
        <div className="mx-4 mb-3 rounded-xl bg-soft p-3.5">
          <div className="text-[13.5px] font-bold">
            미입금 {unpaid.length}건 · {unpaid.reduce((a, b) => a + b.quantity, 0)}명
          </div>
          <div className="mt-2.5 grid gap-2">
            <button
              type="button"
              onClick={() =>
                copy(unpaid.map((b) => b.phone).join(", "), "phones")
              }
              className="rounded-lg border border-line bg-white py-2.5 text-[13px] font-semibold"
            >
              {copied === "phones" ? "복사됨" : "연락처 한 번에 복사"}
            </button>
            <button
              type="button"
              onClick={() =>
                copy(
                  [
                    `[${eventTitle}]`,
                    "입금이 아직 확인되지 않았어요.",
                    bankAccount,
                    "입금자명은 예매번호와 이름을 함께 적어 주세요.",
                    "24시간이 지나면 자동 취소됩니다.",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  "text",
                )
              }
              className="rounded-lg border border-line bg-white py-2.5 text-[13px] font-semibold"
            >
              {copied === "text" ? "복사됨" : "독촉 문구 복사"}
            </button>
          </div>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-sub">
          조건에 맞는 예매가 없어요.
        </p>
      ) : (
        shown.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-3 border-b border-line px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-bold">{b.name}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                    b.gender === "F"
                      ? "bg-[#FDE8EE] text-[#C2185B]"
                      : "bg-[#E4EEFB] text-[#1565C0]"
                  }`}
                >
                  {b.gender === "F" ? "여" : "남"}
                </span>
                {b.invite_code ? (
                  <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                    {b.invite_code}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[12.5px] text-sub">
                <a
                  href={`tel:${b.phone.replace(/[^0-9+]/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  className="underline"
                >
                  {b.phone}
                </a>
                <a
                  href={`sms:${b.phone.replace(/[^0-9+]/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold"
                >
                  문자
                </a>
                <span className="truncate">
                  {b.quantity}명 · {tierName(b.tier_id)}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] font-semibold text-[#9AA0AA]">
                {b.code}
                {b.status === "checked_in" ? " · 입장 완료" : ""}
              </div>
            </div>
            <div className="flex flex-none flex-col items-end gap-1.5">
              <span className="text-[14px] font-extrabold">
                {won(b.amount)}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  start(() => void setPaid(b.id, b.status === "pending"))
                }
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${
                  b.status === "pending"
                    ? "bg-soft text-sub"
                    : "bg-[#E7F7EF] text-ok"
                }`}
              >
                {b.status === "pending" ? "입금 확인" : "입금 완료"}
              </button>
            </div>
          </div>
        ))
      )}

      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() =>
            csvDownload(rows, tierName, `${eventTitle}_명단.csv`)
          }
          className="w-full rounded-xl border border-line py-3.5 text-[15px] font-semibold"
        >
          명단 CSV 내려받기
        </button>
      </div>
    </>
  );
}
