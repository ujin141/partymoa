"use client";

import { useState, useTransition } from "react";

import { addGuest } from "@/app/(crew)/crew/actions";
import { phoneMask, won } from "@/lib/format";
import { priceFor } from "@/lib/rules";
import type { EventTable, TicketTier } from "@/types/database";

const input =
  "w-full rounded-xl bg-soft p-3 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

/**
 * 명단에 손님을 직접 넣는다.
 *
 * DM·전화·현장으로 받는 건이 계속 들어온다. 예전에는 그때마다 SQL 파일을
 * 고쳐 돌렸다 — **행사 당일 입구에서 노트북을 열 수는 없다.**
 *
 * 기본값을 현장 기준으로 잡았다. 손으로 받는 건은 대개 **이미 돈을 받은**
 * 건이라 입금 완료가 켜져 있고, 인원은 1명이다.
 */
export function AddGuest({
  eventId,
  tiers,
  tables,
  guestPrice,
  maleMultiplier,
}: {
  eventId: string;
  tiers: TicketTier[];
  tables: EventTable[];
  guestPrice: number | null;
  maleMultiplier: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"F" | "M" | null>(null);
  const [qty, setQty] = useState(1);
  const [tierId, setTierId] = useState<string | null>(null);
  const [invite, setInvite] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(true);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const openTiers = tiers.filter((t) => !t.closed_at);
  const tier =
    tiers.find((t) => t.id === tierId) ??
    openTiers[openTiers.length - 1] ??
    null;

  /** 비워 두면 얼마가 되는지. 크루가 굳이 안 적어도 되게 미리 보여 준다 */
  const auto =
    tier && gender
      ? (invite.trim() && guestPrice != null
          ? guestPrice
          : priceFor(tier.price, gender, maleMultiplier, tier.male_price)) * qty
      : null;

  function reset() {
    setName("");
    setPhone("");
    setGender(null);
    setQty(1);
    setInvite("");
    setTableId(null);
    setAmount("");
    setErr(null);
  }

  function submit(force: boolean) {
    setErr(null);
    start(async () => {
      const r = await addGuest({
        eventId,
        name,
        phone: phoneMask(phone),
        gender: gender!,
        quantity: qty,
        tierId: tier?.id ?? null,
        inviteCode: invite || null,
        tableId,
        amount: amount ? Number(amount) : null,
        paid,
        force,
      });
      if (!r.ok) {
        // 정원·성비를 넘을 때만 한 번 더 묻는다. 나머지는 그냥 막는다
        if (r.over && !force && confirm(`${r.message}\n\n그래도 넣을까요?`)) {
          submit(true);
          return;
        }
        setErr(r.message);
        return;
      }
      setDone(r.code);
      reset();
      setTimeout(() => setDone(null), 4000);
    });
  }

  const ready = Boolean(name.trim() && phone.trim() && gender);

  if (!open) {
    return (
      <div className="px-4 pb-1">
        {done ? (
          <p className="mb-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-[13px] font-semibold text-brand">
            {`${done} 으로 넣었어요.`}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold"
        >
          손님 직접 추가
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 rounded-xl border border-line p-3.5">
      <div className="mb-3 flex items-center">
        <b className="text-[15px] font-extrabold">손님 추가</b>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="ml-auto text-[13px] text-sub"
        >
          닫기
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <input
          className={`${input} flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
        />
        <input
          className={`${input} flex-1`}
          value={phone}
          inputMode="tel"
          onChange={(e) => setPhone(phoneMask(e.target.value))}
          placeholder="010-0000-0000"
        />
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        {(["F", "M"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGender(g)}
            className={`rounded-xl border-[1.5px] py-3 text-[14.5px] font-semibold ${
              gender === g
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-white"
            }`}
          >
            {g === "F" ? "여성" : "남성"}
          </button>
        ))}
      </div>

      <div className="mb-2 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setQty(n)}
            className={`rounded-xl border-[1.5px] py-2.5 text-[14px] font-semibold ${
              qty === n
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-white"
            }`}
          >
            {`${n}명`}
          </button>
        ))}
      </div>

      <input
        className={`${input} mb-2 uppercase`}
        value={invite}
        onChange={(e) => setInvite(e.target.value.toUpperCase())}
        placeholder="추천인 코드 (선택)"
      />

      {tables.length ? (
        <select
          className={`${input} mb-2`}
          value={tableId ?? ""}
          onChange={(e) => setTableId(e.target.value || null)}
        >
          <option value="">테이블 없음</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {`${t.name} · ${t.seats}인`}
            </option>
          ))}
        </select>
      ) : null}

      {openTiers.length > 1 ? (
        <select
          className={`${input} mb-2`}
          value={tier?.id ?? ""}
          onChange={(e) => setTierId(e.target.value || null)}
        >
          {openTiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : null}

      <input
        className={`${input} mb-1`}
        value={amount}
        inputMode="numeric"
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        placeholder={auto != null ? `비우면 ${won(auto)}` : "금액"}
      />
      <p className="mb-2.5 text-[12px] leading-relaxed text-sub">
        비워 두면 차수 가격으로 계산해요. 테이블 손님처럼 입장비가 없으면
        0 을 넣으세요.
      </p>

      <button
        type="button"
        onClick={() => setPaid(!paid)}
        className={`mb-3 w-full rounded-xl border-[1.5px] py-3 text-[14.5px] font-semibold ${
          paid
            ? "border-ok bg-[#E7F7EF] text-ok"
            : "border-line bg-white text-sub"
        }`}
      >
        {paid ? "입금 완료로 넣기" : "미입금으로 넣기"}
      </button>

      {err ? (
        <p className="mb-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={() => submit(false)}
        className="w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "넣는 중…" : "명단에 넣기"}
      </button>
    </div>
  );
}
