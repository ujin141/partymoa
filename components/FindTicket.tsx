"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyButton } from "@/components/CopyButton";
import { StatusPill } from "@/components/ui/primitives";
import { won } from "@/lib/format";
import type { Booking } from "@/types/database";

type Found = Booking & {
  bank_account?: string | null;
  event_title?: string | null;
};

/**
 * 티켓 찾기.
 *
 * 로그인 없이 예매를 받는 대신 기기를 바꾸면 티켓을 잃는다.
 *
 * **이름 + 연락처가 기본이다.** 예전에는 예매번호(PM0001)를 반드시
 * 받았는데, 문자를 지웠거나 기기를 바꾼 사람은 그 번호를 모른다 —
 * 정작 티켓이 필요한 순간에 못 찾는다.
 *
 * 연락처만으로는 안 연다. 번호만 넣으면 남의 번호를 아는 사람이 그 사람이
 * 어느 파티에 가는지 다 본다. 이름을 같이 받으면 외울 건 없어지면서
 * 아무나 열지는 못한다.
 *
 * 세션이 있으면 찾은 티켓이 세션에 붙어 다음부터 목록에 그냥 뜬다.
 */
export function FindTicket() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [byCode, setByCode] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);

  function reset() {
    setFound(null);
    setOpen(false);
    setName("");
    setPhone("");
    setCode("");
    setErr(null);
  }

  if (found) {
    return (
      <div className="mt-3">
        {found.length > 1 ? (
          <p className="mb-2 text-[13px] text-sub">{`${found.length}건 찾았어요.`}</p>
        ) : null}
        {found.map((t) => (
          <article
            key={t.id}
            className="mb-2.5 overflow-hidden rounded-card border border-line"
          >
            <div className="px-4 py-4">
              <StatusPill status={t.status} />
              <h3 className="mt-2 text-[17px] font-extrabold">
                {t.event_title ?? "예매 확인"}
              </h3>
              <p className="mt-1.5 text-[13.5px] text-sub">
                {`${t.name} · ${t.quantity}명`}
              </p>
            </div>
            <div className="flex items-end justify-between border-t border-dashed border-line bg-soft px-4 py-3.5">
              <div>
                <small className="text-[12.5px] text-sub">예매번호</small>
                <div className="text-2xl font-extrabold">{t.code}</div>
              </div>
              <div className="text-right">
                <small className="text-[12.5px] text-sub">결제금액</small>
                <div className="text-lg font-extrabold">{won(t.amount)}</div>
              </div>
            </div>
            {t.status === "pending" && t.bank_account ? (
              <div className="border-t border-line px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <small className="text-[12.5px] text-sub">입금 계좌</small>
                    <div className="truncate text-[15px] font-bold">
                      {t.bank_account}
                    </div>
                  </div>
                  <CopyButton text={t.bank_account} label="계좌 복사" />
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-sub">
                  입금자명은{" "}
                  <b className="text-ink">{`${t.code} ${t.name}`}</b> 으로 넣어
                  주세요.
                </p>
              </div>
            ) : null}
          </article>
        ))}
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl border border-line py-3 text-[13.5px] font-semibold text-sub"
        >
          닫기
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-xl border border-line py-3.5 text-[14.5px] font-semibold"
      >
        내 티켓 찾기
      </button>
    );
  }

  const ready = byCode
    ? Boolean(code.trim() && phone.trim())
    : Boolean(name.trim() && phone.replace(/[^0-9]/g, "").length >= 8);

  const input =
    "w-full rounded-lg bg-soft p-3 text-[14.5px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

  return (
    <div className="mt-2 rounded-xl border border-line p-3.5">
      <p className="mb-2.5 text-[12.5px] leading-relaxed text-sub">
        예매할 때 적은 이름과 연락처를 넣어 주세요.
      </p>

      {byCode ? (
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예매번호 PM0001"
          className={`${input} mb-2 uppercase`}
        />
      ) : (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className={`${input} mb-2`}
        />
      )}
      <input
        value={phone}
        inputMode="tel"
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-0000-0000"
        className={input}
      />

      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch("/api/bookings/find", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(
                byCode ? { code, phone } : { name, phone },
              ),
            });
            const body = await res.json();
            if (!res.ok) {
              setErr(body.message);
              return;
            }
            setFound(body.tickets as Found[]);
            router.refresh();
          } catch {
            setErr("네트워크가 불안정해요. 다시 시도해 주세요.");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-2.5 w-full rounded-xl bg-ink py-3 text-[14.5px] font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "찾는 중…" : "찾기"}
      </button>

      <button
        type="button"
        onClick={() => {
          setByCode(!byCode);
          setErr(null);
        }}
        className="mt-3 w-full text-center text-[13px] text-sub underline"
      >
        {byCode ? "이름으로 찾기" : "예매번호로 찾기"}
      </button>
    </div>
  );
}
