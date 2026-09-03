"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { AddGuest } from "@/components/crew/AddGuest";
import {
  cancelBooking,
  setBookingGender,
  setBookingInvite,
  setPaid,
} from "@/app/(crew)/crew/actions";
import { phoneText, stampFull, won } from "@/lib/format";
import { priceFor } from "@/lib/rules";
import type {
  Booking,
  CrewMember,
  EventTable,
  TicketTier,
} from "@/types/database";

const FILTERS = [
  "전체",
  "일반",
  "게스트",
  "테이블",
  "무료",
  "미입금",
  "입금완료",
  "입장완료",
  "1인",
] as const;
type Filter = (typeof FILTERS)[number];

/**
 * 예매 한 건의 성격.
 *
 * 현장에서 제일 먼저 갈리는 게 이것이다 — 돈 내고 온 손님인지, DJ 가
 * 데려온 게스트인지, 크루가 그냥 넣어 준 사람인지. 셋이 섞여 있으면
 * 문 앞에서 매번 금액을 확인해야 한다.
 *
 * 판단 근거는 저장된 값이다. 초대 코드가 있으면 그 DJ 의 게스트고,
 * 0원이면 무료입장이다. 따로 표시를 저장하지 않는다.
 */
type Kind = "일반" | "게스트" | "테이블" | "무료";

/**
 * **테이블이 제일 먼저다.** 테이블 손님은 입장비가 0 원이라 예전에는
 * 무료입장으로 분류됐다 — 크루가 그냥 넣어 준 사람과 30만원짜리 테이블을
 * 잡은 손님이 문 앞에서 똑같이 보였다.
 *
 * 추천인이 같이 적혀 있어도 테이블이 이긴다. 입구에서 필요한 건
 * "이 사람 어디 앉나" 지 "누가 데려왔나" 가 아니다.
 */
const kindOf = (b: Booking): Kind =>
  b.table_id
    ? "테이블"
    : b.invite_code
      ? "게스트"
      : b.amount === 0
        ? "무료"
        : "일반";

/**
 * 검색 한 건. 번호는 **하이픈 있는 벌과 숫자만인 벌을 둘 다** 넣는다.
 *
 * 앱으로 들어온 건은 손님이 친 대로, 손으로 넣은 건은 적은 대로 저장돼서
 * 형식이 섞여 있다. 입구에서 "2624" 를 쳤는데 안 나오면 그 사람을 못 찾는다.
 */
function hits(b: Booking, needle: string): boolean {
  const digits = b.phone.replace(/\D/g, "");
  const hay =
    `${b.name}${b.phone}${digits}${b.code}${b.invite_code ?? ""}`.toLowerCase();
  if (hay.includes(needle)) return true;
  const nd = needle.replace(/\D/g, "");
  return nd.length > 0 && hay.includes(nd);
}

function csvDownload(
  rows: Booking[],
  tierName: (id: string) => string,
  memberName: (code: string | null) => string,
  tableName: (id: string | null) => string,
  fileName: string,
) {
  const head = [
    "구분",
    "테이블",
    "추천인",
    "초대코드",
    "이름",
    "연락처",
    "성별",
    "인원",
    "차수",
    "금액",
    "입금",
    "입장",
    "예매번호",
    "신청일시",
  ];
  // **구분 → DJ → 이름 순으로 정렬해서 내보낸다.** 엑셀에서 다시 정렬하지
  // 않아도 게스트가 DJ 별로 묶여 나온다 — 정산할 때 그대로 쓴다
  const order: Record<Kind, number> = { 일반: 0, 게스트: 1, 테이블: 2, 무료: 3 };
  const sorted = [...rows].sort(
    (x, y) =>
      order[kindOf(x)] - order[kindOf(y)] ||
      (x.invite_code ?? "").localeCompare(y.invite_code ?? "") ||
      x.name.localeCompare(y.name, "ko"),
  );
  const body = sorted.map((b) => [
    kindOf(b),
    tableName(b.table_id),
    memberName(b.invite_code),
    b.invite_code ?? "",
    b.name,
    phoneText(b.phone),
    b.gender === "F" ? "여" : "남",
    b.quantity,
    tierName(b.tier_id),
    b.amount,
    b.status === "pending" ? "대기" : "완료",
    b.status === "checked_in" ? "완료" : "",
    b.code,
    stampFull(b.created_at),
  ]);
  /**
   * 합계.
   *
   * **엑셀에서 다시 더하게 하지 않는다.** 정산할 때 필요한 건 명단이
   * 아니라 이 숫자들이고, 손으로 더하면 그 자리에서 틀린다.
   *
   * 셋으로 나눈다 — 무엇으로 얼마가 들어왔나(구분), 얼마가 실제로
   * 들어왔나(입금), 누가 데려왔나(추천인). 마지막 것이 크루와 나눌 때
   * 근거가 된다.
   *
   * **인원은 건수가 아니라 사람 수다.** 4명 예매 한 건은 1건이 아니라
   * 4명으로 센다 — 입장할 때 문을 지나는 건 네 명이다.
   */
  const heads = (list: Booking[]) => list.reduce((a, b) => a + b.quantity, 0);
  const money = (list: Booking[]) => list.reduce((a, b) => a + b.amount, 0);
  const paid = sorted.filter((b) => b.status !== "pending");
  const pending = sorted.filter((b) => b.status === "pending");

  const sum: (string | number)[][] = [
    [],
    ["합계"],
    ["구분", "인원", "금액"],
  ];
  for (const k of ["일반", "게스트", "테이블", "무료"] as Kind[]) {
    const g = sorted.filter((b) => kindOf(b) === k);
    if (g.length) sum.push([k, heads(g), money(g)]);
  }
  sum.push(["전체", heads(sorted), money(sorted)]);

  sum.push([], ["입금", "인원", "금액"]);
  sum.push(["완료", heads(paid), money(paid)]);
  sum.push(["대기", heads(pending), money(pending)]);

  sum.push([], ["성별", "인원"]);
  for (const [label, g] of [
    ["여", sorted.filter((b) => b.gender === "F")],
    ["남", sorted.filter((b) => b.gender === "M")],
  ] as [string, Booking[]][]) {
    sum.push([label, heads(g)]);
  }

  sum.push([], ["입장", "인원"]);
  sum.push(["완료", heads(sorted.filter((b) => b.status === "checked_in"))]);

  const codes = [...new Set(sorted.map((b) => b.invite_code ?? ""))];
  if (codes.some((c) => c)) {
    sum.push([], ["추천인", "코드", "인원", "금액"]);
    for (const c of codes.sort()) {
      const g = sorted.filter((b) => (b.invite_code ?? "") === c);
      sum.push([c ? memberName(c) : "없음", c, heads(g), money(g)]);
    }
  }

  // **BOM 을 반드시 붙인다.** 없으면 엑셀에서 한글이 깨진다
  const text =
    "﻿" +
    [head, ...body, ...sum]
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
  members,
  tables,
  eventTitle,
  bankAccount,
  guestPrice,
  maleMultiplier,
  eventId,
}: {
  bookings: Booking[];
  tiers: TicketTier[];
  members: CrewMember[];
  tables: EventTable[];
  eventTitle: string;
  bankAccount: string | null;
  guestPrice: number | null;
  maleMultiplier: number;
  eventId: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("전체");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const tierName = (id: string) =>
    tiers.find((t) => t.id === id)?.name ?? "";

  /**
   * 코드 → 그 크루원 이름.
   *
   * 명단에 코드만 뜨면 크루 안에서도 "TS 가 누구였지" 를 묻게 된다.
   * 멤버에서 지운 코드는 이름을 못 찾지만 집계는 남아야 하므로,
   * 못 찾으면 코드를 그대로 쓴다.
   */
  const tableOf = (id: string | null) =>
    id ? (tables.find((t) => t.id === id) ?? null) : null;

  const memberName = (code: string | null) =>
    (code && members.find((m) => m.invite_code === code)?.display_name) ||
    code ||
    "";

  /**
   * 추천인이 없었다면 얼마였을지. 게스트가가 얼마를 깎았는지 보여주려면
   * 원래 값이 있어야 한다.
   *
   * **화면용 사본이다.** 실제 금액은 서버의 tier_price() 가 정했고,
   * 둘이 어긋나면 서버가 맞다 — 그래서 깎인 게 아니면 아무것도 안 띄운다.
   */
  /**
   * 성별을 바꾸면 얼마가 되는지. 화면용 사본이고 실제 계산은 서버가 한다.
   * 게스트는 성별과 무관하게 게스트가라 안 바뀐다.
   */
  const wouldCost = (b: Booking, gender: "F" | "M") => {
    if (b.invite_code && guestPrice != null) return guestPrice * b.quantity;
    const t = tiers.find((x) => x.id === b.tier_id);
    if (!t) return null;
    return priceFor(t.price, gender, maleMultiplier, t.male_price) * b.quantity;
  };

  const listPriceOf = (b: Booking) => {
    const t = tiers.find((x) => x.id === b.tier_id);
    if (!t) return null;
    return priceFor(t.price, b.gender, maleMultiplier, t.male_price) * b.quantity;
  };

  const rows = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((b) => {
      // **번호에 하이픈이 있는 건과 없는 건이 섞여 있다.** 숫자만 쳐도,
      // 하이픈째 쳐도 걸리게 두 벌을 다 넣고 본다
      if (needle && !hits(b, needle)) return false;
      if (filter === "일반") return kindOf(b) === "일반";
      if (filter === "게스트") return kindOf(b) === "게스트";
      if (filter === "테이블") return kindOf(b) === "테이블";
      if (filter === "무료") return kindOf(b) === "무료";
      if (filter === "미입금") return b.status === "pending";
      if (filter === "입금완료") return b.status === "paid";
      if (filter === "입장완료") return b.status === "checked_in";
      if (filter === "1인") return b.quantity === 1;
      return true;
    });
  }, [rows, q, filter]);

  /**
   * 구분 → DJ → 이름 순으로 묶는다.
   *
   * 셋이 섞여 있으면 문 앞에서 매번 금액을 확인해야 한다. 게스트는 DJ
   * 별로 이어 붙여서, 그 DJ 가 몇 명 데려왔는지 줄만 세면 보이게 한다.
   */
  const groups = useMemo(() => {
    const order: Kind[] = ["일반", "게스트", "테이블", "무료"];
    return order
      .map((kind) => ({
        kind,
        rows: shown
          .filter((b) => kindOf(b) === kind)
          .sort(
            (x, y) =>
              (x.table_id ?? "").localeCompare(y.table_id ?? "") ||
              (x.invite_code ?? "").localeCompare(y.invite_code ?? "") ||
              x.name.localeCompare(y.name, "ko"),
          ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [shown]);

  const heads = rows.reduce((a, b) => a + b.quantity, 0);
  const unpaid = rows.filter((b) => b.status === "pending");
  const tally = (kind: Kind) =>
    rows.filter((b) => kindOf(b) === kind).reduce((a, b) => a + b.quantity, 0);

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
      <div className="flex items-baseline justify-between px-4 pb-1 pt-5">
        <h2 className="text-[19px] font-extrabold">명단</h2>
        <span className="text-[13px] text-sub">
          {`${rows.length}건 · ${heads}명`}
        </span>
      </div>
      <p className="px-4 pb-3 text-[12.5px] text-sub">
        {`일반 ${tally("일반")} · 게스트 ${tally("게스트")} · 테이블 ${tally("테이블")} · 무료 ${tally("무료")}`}
      </p>

      <AddGuest
        eventId={eventId}
        tiers={tiers}
        tables={tables}
        guestPrice={guestPrice}
        maleMultiplier={maleMultiplier}
      />

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
                copy(unpaid.map((b) => phoneText(b.phone)).join(", "), "phones")
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
        groups.map((g) => (
          <div key={g.kind}>
            {/* 구분 머리. 화면을 훑을 때 여기서 한 번 끊긴다 */}
            <div className="sticky top-0 z-1 flex items-center gap-2 border-y border-line bg-soft px-4 py-1.5">
              <b className="text-[12.5px] font-extrabold">
                {g.kind === "게스트"
                  ? "DJ 게스트"
                  : g.kind === "테이블"
                    ? "테이블"
                    : g.kind === "무료"
                      ? "무료입장"
                      : "일반 예매"}
              </b>
              <span className="text-[12px] text-sub">
                {`${g.rows.reduce((a, b) => a + b.quantity, 0)}명`}
              </span>
              {/* 규칙을 한 줄로 붙여 둔다. 크루가 "게스트는 얼마였지" 를
                  다시 묻지 않게 */}
              {g.kind === "게스트" && guestPrice != null ? (
                <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                  {`추천인가 ${won(guestPrice)}`}
                </span>
              ) : null}
            </div>
            {g.rows.map((b, i) => (
            <Fragment key={b.id}>
            {/* DJ 가 바뀌는 자리에 이름을 한 줄 끼운다. 게스트는 DJ 별로
                줄만 세면 몇 명 데려왔는지 보여야 한다 */}
            {g.kind === "테이블" &&
            b.table_id !== g.rows[i - 1]?.table_id ? (
              <div className="flex items-center gap-2 bg-white px-4 pb-1 pt-3">
                <b className="text-[13px] font-extrabold text-brand">
                  {tableOf(b.table_id)?.name ?? "테이블"}
                </b>
                <span className="text-[12px] text-sub">
                  {`${g.rows
                    .filter((x) => x.table_id === b.table_id)
                    .reduce((a, x) => a + x.quantity, 0)}명`}
                </span>
                {tableOf(b.table_id)?.note ? (
                  <span className="truncate text-[11.5px] text-sub">
                    {tableOf(b.table_id)!.note}
                  </span>
                ) : null}
                {/* 테이블 정가. 실제로 받은 돈은 정산의 수입 항목에 있다 */}
                <span className="ml-auto flex-none text-[12px] font-bold text-sub">
                  {won(tableOf(b.table_id)?.price ?? 0)}
                </span>
              </div>
            ) : null}
            {g.kind === "게스트" &&
            b.invite_code !== g.rows[i - 1]?.invite_code ? (
              <div className="flex items-center gap-2 bg-white px-4 pb-1 pt-3">
                <b className="text-[13px] font-extrabold text-brand">
                  {memberName(b.invite_code)}
                </b>
                <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                  {b.invite_code}
                </span>
                <span className="text-[12px] text-sub">
                  {`${g.rows
                    .filter((x) => x.invite_code === b.invite_code)
                    .reduce((a, x) => a + x.quantity, 0)}명`}
                </span>
                {/* 이 DJ 가 데려온 사람들의 합계. 정산에서 바로 쓴다 */}
                <span className="ml-auto text-[12px] font-bold text-sub">
                  {won(
                    g.rows
                      .filter((x) => x.invite_code === b.invite_code)
                      .reduce((a, x) => a + x.amount, 0),
                  )}
                </span>
              </div>
            ) : null}
            <div
              className="flex items-center gap-3 border-b border-line px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold">{b.name}</span>
                  {/* **성별은 성비 정원에 그대로 들어간다.** 잘못 받은 걸
                      고치러 노트북을 열 수는 없어서 여기서 바로 바꾼다.
                      금액이 달라지는 경우에는 한 번 더 묻는다 */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const next = b.gender === "F" ? "M" : "F";
                      const label = next === "F" ? "여성" : "남성";
                      if (!confirm(`${b.name} 님을 ${label}으로 바꿀까요?`))
                        return;
                      const now = b.amount;
                      const then = wouldCost(b, next);
                      const reprice =
                        then != null &&
                        then !== now &&
                        confirm(
                          `금액도 ${won(now)} → ${won(then)} 으로 바꿀까요?
` +
                            `취소를 누르면 성별만 바꿉니다.`,
                        );
                      start(async () => {
                        const r = await setBookingGender(b.id, next, reprice);
                        if (!r.ok) alert(r.message);
                      });
                    }}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      b.gender === "F"
                        ? "bg-[#FDE8EE] text-[#C2185B]"
                        : "bg-[#E4EEFB] text-[#1565C0]"
                    }`}
                  >
                    {b.gender === "F" ? "여" : "남"}
                  </button>
                  {b.invite_code && g.kind !== "게스트" ? (
                    <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                      {memberName(b.invite_code)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[12.5px] text-sub">
                  <a
                    href={`tel:${b.phone.replace(/[^0-9+]/g, "")}`}
                    onClick={(e) => e.stopPropagation()}
                    className="underline"
                  >
                    {phoneText(b.phone)}
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
                {/* **깎인 게 보여야 한다.** 금액만 있으면 크루가 "왜 3만원
                    이지" 를 매번 다시 물어본다. 원래 값과 나란히 둔다 */}
                {(() => {
                  const list = listPriceOf(b);
                  const cut = b.invite_code && list != null && list > b.amount;
                  return (
                    <div className="text-right">
                      <span className="text-[14px] font-extrabold">
                        {won(b.amount)}
                      </span>
                      {cut ? (
                        <div className="mt-0.5 flex items-center justify-end gap-1">
                          <s className="text-[11.5px] text-[#B0B4BC]">
                            {won(list)}
                          </s>
                          <span className="rounded bg-brand-soft px-1 py-0.5 text-[10.5px] font-bold text-brand">
                            게스트가
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
                <div className="flex gap-1.5">
                  {/* **거절은 되돌릴 수 없다.** 자리가 바로 다음 사람에게
                      넘어가므로 누구를 자르는지 이름을 대고 묻는다 */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const paid = b.status !== "pending";
                      const warn = paid
                        ? `${b.name} 님은 입금이 확인된 예매예요. 거절하면 자리가 풀리고 환불은 따로 해 주셔야 해요. 계속할까요?`
                        : `${b.name} 님의 예매를 거절할까요? 자리가 바로 풀립니다.`;
                      if (!confirm(warn)) return;
                      start(() => void cancelBooking(b.id));
                    }}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-bold text-sub"
                  >
                    거절
                  </button>
                  {/* **게스트인 걸 뒤늦게 아는 사람이 반드시 있다.**
                      입구에서 "저 아무개 게스트인데요" 를 들었을 때
                      코드만 넣으면 금액은 서버가 다시 계산한다 */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt(
                        `${b.name} 님의 추천인 코드\n비우면 추천인을 뗍니다. 금액은 자동으로 다시 계산돼요.`,
                        b.invite_code ?? "",
                      );
                      if (next === null) return;
                      start(async () => {
                        const r = await setBookingInvite(b.id, next);
                        if (!r.ok) window.alert(r.message);
                      });
                    }}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-bold text-sub"
                  >
                    추천인
                  </button>
                  {/* **되돌릴 때는 묻는다.** 초록 배지처럼 보이지만 실은
                      토글이라, 명단을 훑다 한 번 더 누르면 입금이 풀린다.
                      실제로 그렇게 유종원이 미입금으로 돌아갔다 */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const paying = b.status === "pending";
                      if (
                        !paying &&
                        !confirm(
                          `${b.name} 님을 미입금으로 되돌릴까요?\n입금이 실제로 안 들어온 게 맞을 때만 누르세요.`,
                        )
                      )
                        return;
                      start(() => void setPaid(b.id, paying));
                    }}
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
            </div>
            </Fragment>
            ))}
          </div>
        ))
      )}

      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() =>
            csvDownload(
              rows,
              tierName,
              memberName,
              (id) => tableOf(id)?.name ?? "",
              `${eventTitle}_명단.csv`,
            )
          }
          className="w-full rounded-xl border border-line py-3.5 text-[15px] font-semibold"
        >
          명단 CSV 내려받기
        </button>
      </div>
    </>
  );
}
