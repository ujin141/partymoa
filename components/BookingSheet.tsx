"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { BookingDone } from "@/components/BookingDone";
import { won } from "@/lib/format";
import { genderCap, priceFor, type Gender } from "@/lib/rules";
import type { Booking, TicketTier } from "@/types/database";

interface Props {
  eventId: string;
  eventTitle: string;
  capacity: number;
  genderBalanced: boolean;
  maleMultiplier: number;
  tiers: TicketTier[];
  tierSold: Record<string, number>;
  booked: number;
  bookedF: number;
  bookedM: number;
  soldOut: boolean;
  closed: boolean;
  currentTierName: string | null;
  currentPrice: number | null;
  bankAccount: string | null;
}

/**
 * 예매 바텀시트. 사양서 4-5.
 *
 * **여기서 하는 검증은 전부 화면용이다.** 마감된 차수·성별을 눌리지 않게
 * 하는 것뿐이고, 실제로 자리를 잡는 건 서버의 create_booking 이다.
 * 화면이 통과시켜도 서버가 막으면 서버가 이긴다 — 그 에러를 그대로 띄운다.
 */
export function BookingSheet(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState(1);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  const gcap = genderCap(p.capacity);
  const leftF = p.genderBalanced ? gcap - p.bookedF : p.capacity - p.booked;
  const leftM = p.genderBalanced ? gcap - p.bookedM : p.capacity - p.booked;

  const tier = p.tiers.find((t) => t.id === tierId) ?? null;
  const unit = useMemo(() => {
    if (!tier || !gender) return null;
    return priceFor(tier.price, gender, p.maleMultiplier, tier.male_price);
  }, [tier, gender, p.maleMultiplier]);
  const total = unit ? unit * qty : null;

  const ready = Boolean(tierId && gender && name.trim() && phone.trim());

  function reset() {
    setTierId(null);
    setGender(null);
    setName("");
    setPhone("");
    setQty(1);
    setInvite("");
    setErr(null);
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: p.eventId,
          tierId,
          name: name.trim(),
          phone: phone.trim(),
          gender,
          quantity: qty,
          inviteCode: invite.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.message ?? "예매에 실패했어요. 잠시 뒤 다시 시도해 주세요.");
        setBusy(false);
        router.refresh();
        return;
      }
      // 목록으로 넘기지 않는다. 입금 안내를 여기서 끝까지 보여 준다
      setDone(body as Booking);
      setBusy(false);
      router.refresh();
    } catch {
      setErr("네트워크가 불안정해요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  const disabled = p.soldOut || p.closed;

  return (
    <>
      <div className="flex flex-none items-center gap-3 border-t border-line bg-white px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5">
        <div className="flex-1">
          <small className="block text-xs text-sub">
            {p.closed
              ? "예매가 닫혔어요"
              : p.soldOut
                ? "모든 차수 매진"
                : (p.currentTierName ?? "")}
          </small>
          <b className="text-lg font-extrabold">
            {p.currentPrice ? `${won(p.currentPrice)}부터` : "—"}
          </b>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white disabled:bg-[#C8CBD2]"
        >
          {disabled ? "마감" : "예매하기"}
        </button>
      </div>

      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 z-8 bg-[#0a0c10]/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        className={`absolute inset-x-0 bottom-0 z-9 flex max-h-[92%] flex-col rounded-t-[20px] bg-white transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(.32,.72,0,1)" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 flex-none rounded-full bg-[#DDE0E6]" />
        <header className="flex items-center px-4 pb-3 pt-2">
          <b className="text-[17px] font-extrabold">
            {done ? "예매 신청 완료" : "예매하기"}
          </b>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              if (done) {
                setDone(null);
                reset();
              }
            }}
            className="ml-auto text-2xl text-sub"
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        {done ? (
          <BookingDone
            booking={done}
            eventTitle={p.eventTitle}
            bankAccount={p.bankAccount}
          />
        ) : (
        <>

        <div className="flex-1 overflow-y-auto px-4">
          <p className="mb-3 text-[13.5px] text-sub">{p.eventTitle}</p>

          <label className="mb-1.5 block text-[13.5px] font-bold">
            티켓 차수
          </label>
          {p.tiers.map((t) => {
            const sold = p.tierSold[t.id] ?? 0;
            const out = sold >= t.capacity;
            const price = priceFor(t.price, gender ?? "F", p.maleMultiplier, t.male_price);
            return (
              <button
                key={t.id}
                type="button"
                disabled={out}
                aria-pressed={tierId === t.id}
                onClick={() => setTierId(t.id)}
                className={`mb-2 flex w-full items-center justify-between rounded-xl border-[1.5px] p-3.5 text-left disabled:opacity-45 ${
                  tierId === t.id
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-white"
                }`}
              >
                <span>
                  <span className="block text-[15px] font-bold">{t.name}</span>
                  <span
                    className={`mt-0.5 block text-[12.5px] ${
                      !out && t.capacity - sold <= 10
                        ? "font-bold text-hot"
                        : "text-sub"
                    }`}
                  >
                    {/* 안내 문구를 끝까지 붙여 두면 10장 남았는데도
                        "선착순 40명" 이 보인다. 남은 게 적으면 숫자를 앞세운다 */}
                    {out
                      ? "매진"
                      : t.capacity - sold <= 10
                        ? `${t.capacity - sold}장 남음`
                        : (t.note ?? `${t.capacity - sold}장 남음`)}
                  </span>
                </span>
                <span className="text-base font-extrabold">{won(price)}</span>
              </button>
            );
          })}

          <div className="mt-4 mb-4">
            <label className="mb-1.5 block text-[13.5px] font-bold">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="입금자명과 같게 적어 주세요"
              className="w-full rounded-xl border-[1.5px] border-transparent bg-soft p-3.5 text-[15.5px] outline-none focus:border-brand focus:bg-white"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-[13.5px] font-bold">
              연락처
            </label>
            <input
              value={phone}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-xl border-[1.5px] border-transparent bg-soft p-3.5 text-[15.5px] outline-none focus:border-brand focus:bg-white"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-[13.5px] font-bold">성별</label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ["F", "여성", leftF],
                  ["M", "남성", leftM],
                ] as const
              ).map(([g, label, left]) => (
                <button
                  key={g}
                  type="button"
                  disabled={left <= 0}
                  aria-pressed={gender === g}
                  onClick={() => setGender(g)}
                  className={`rounded-xl border-[1.5px] p-3.5 text-[15px] font-semibold disabled:opacity-45 ${
                    gender === g
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-white"
                  }`}
                >
                  {label}
                  {left <= 0 ? " 마감" : ""}
                </button>
              ))}
            </div>
            {p.genderBalanced ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-sub">
                성비를 맞추려고 남녀 각각 {gcap}명까지 받아요.
              </p>
            ) : null}
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-[13.5px] font-bold">인원</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={qty === n}
                  onClick={() => setQty(n)}
                  className={`rounded-xl border-[1.5px] px-1 py-3.5 text-[14px] font-semibold ${
                    qty === n
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-white"
                  }`}
                >
                  {n === 1 ? "1명 (혼자)" : `${n}명`}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-[13.5px] font-bold">
              초대 코드 <span className="font-normal text-sub">(선택)</span>
            </label>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value.toUpperCase())}
              placeholder="크루 멤버에게 받은 코드"
              className="w-full rounded-xl border-[1.5px] border-transparent bg-soft p-3.5 text-[15.5px] uppercase outline-none focus:border-brand focus:bg-white"
            />
          </div>
          <div className="h-2" />
        </div>

        {err ? (
          <p className="px-4 pb-2 text-[13px] font-semibold text-hot">{err}</p>
        ) : null}

        <div className="flex items-center gap-3 border-t border-line px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5">
          <div className="flex-1">
            <small className="block text-xs text-sub">총 결제금액</small>
            <b className="text-lg font-extrabold">
              {total ? won(total) : "—"}
            </b>
          </div>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={submit}
            className="rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white disabled:bg-[#C8CBD2]"
          >
            {busy ? "신청 중…" : "신청하기"}
          </button>
        </div>
          </>
        )}
      </div>
    </>
  );
}
