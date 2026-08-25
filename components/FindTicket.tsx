"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyButton } from "@/components/CopyButton";
import { StatusPill } from "@/components/ui/primitives";
import { won } from "@/lib/format";
import type { Booking } from "@/types/database";

type Found = Booking & { bank_account?: string | null; event_title?: string };

/**
 * 예매번호 + 연락처로 티켓 찾기.
 *
 * 로그인 없이 예매를 받는 대신 기기를 바꾸면 티켓을 잃는다. 문자로 받은
 * 예매번호와 본인 연락처가 **둘 다** 맞아야 열린다 — 번호만으로는 안 된다.
 *
 * 세션이 있으면 그 티켓이 세션에 붙어 다음부터 목록에 그냥 뜬다. 익명
 * 로그인을 꺼 둔 프로젝트에서는 붙지 않으므로 찾은 결과를 여기서 직접
 * 보여 준다 — 어느 쪽이든 손님은 계좌를 본다.
 */
export function FindTicket() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);

  if (found) {
    return (
      <article className="mt-3 overflow-hidden rounded-card border border-line">
        <div className="px-4 py-4">
          <StatusPill status={found.status} />
          <h3 className="mt-2 text-[17px] font-extrabold">
            {found.event_title ?? "예매 확인"}
          </h3>
          <p className="mt-1.5 text-[13.5px] text-sub">
            {found.name} · {found.quantity}명
          </p>
        </div>
        <div className="flex items-end justify-between border-t border-dashed border-line bg-soft px-4 py-3.5">
          <div>
            <small className="text-[12.5px] text-sub">예매번호</small>
            <div className="text-2xl font-extrabold">{found.code}</div>
          </div>
          <div className="text-right">
            <small className="text-[12.5px] text-sub">결제금액</small>
            <div className="text-lg font-extrabold">{won(found.amount)}</div>
          </div>
        </div>
        {found.status === "pending" && found.bank_account ? (
          <div className="border-t border-line px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <small className="text-[12.5px] text-sub">입금 계좌</small>
                <div className="truncate text-[15px] font-bold">
                  {found.bank_account}
                </div>
              </div>
              <CopyButton text={found.bank_account} label="계좌 복사" />
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-sub">
              입금자명은{" "}
              <b className="text-ink">
                {found.code} {found.name}
              </b>{" "}
              으로 넣어 주세요.
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setFound(null);
            setOpen(false);
            setCode("");
            setPhone("");
          }}
          className="w-full border-t border-line py-3 text-[13.5px] font-semibold text-sub"
        >
          닫기
        </button>
      </article>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-xl border border-line py-3.5 text-[14.5px] font-semibold"
      >
        예매번호로 티켓 찾기
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-line p-3.5">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="PM0001"
          className="w-28 flex-none rounded-lg bg-soft p-3 text-[14.5px] uppercase outline-none"
        />
        <input
          value={phone}
          inputMode="tel"
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          className="min-w-0 flex-1 rounded-lg bg-soft p-3 text-[14.5px] outline-none"
        />
      </div>
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <button
        type="button"
        disabled={busy || !code.trim() || !phone.trim()}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await fetch("/api/bookings/find", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, phone }),
          });
          const body = await res.json();
          setBusy(false);
          if (!res.ok) {
            setErr(body.message);
            return;
          }
          setFound(body);
          router.refresh();
        }}
        className="mt-2.5 w-full rounded-xl bg-ink py-3 text-[14.5px] font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "찾는 중…" : "찾기"}
      </button>
    </div>
  );
}
