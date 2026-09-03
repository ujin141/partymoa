"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BookingDone } from "@/components/BookingDone";
import { phoneMask, phoneOk, won } from "@/lib/format";
import {
  genderCap,
  HOLD_HOURS,
  priceFor,
  REFUND_CUTOFF_DAYS,
  type Gender,
} from "@/lib/rules";
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
  /** 이미 잡아 둔 예매의 코드. 있으면 다시 못 넣는다 */
  mine?: string | null;
  closed: boolean;
  currentTierName: string | null;
  currentPrice: number | null;
  /** 초대 링크로 들어왔을 때 미리 채울 코드 */
  invite?: string | null;
  /** 프로필에 적어 둔 이름·연락처 */
  defaultName?: string | null;
  defaultPhone?: string | null;
  /** 진짜 로그인한 사람인가 (익명 세션은 아니다) */
  signedIn?: boolean;
  /** 로그인하고 돌아올 자리 */
  loginNext?: string;
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
  /**
   * 로그인 권유. **예매를 막지는 않는다** — 로그인 없이 예매하는 게
   * 이 앱의 첫 목표다. 다만 로그인해 두면 기기를 바꿔도 티켓이 따라오고,
   * 입금 확인 알림도 받을 수 있어서 그걸 한 번 말해 준다.
   *
   * 한 번 보고 나면 그 세션에서는 다시 안 띄운다. 예매하려고 누를 때마다
   * 같은 창이 뜨면 그게 예매를 막는 셈이다.
   */
  const [askLogin, setAskLogin] = useState(false);
  const [tierId, setTierId] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  // 프로필에 적어 둔 값을 미리 채운다. 매번 다시 적는 게 제일 귀찮고,
  // 오타가 나면 입금자명이 안 맞아 대조가 깨진다
  const [name, setName] = useState(p.defaultName ?? "");
  const [phone, setPhone] = useState(phoneMask(p.defaultPhone ?? ""));
  const [qty, setQty] = useState(1);
  // 멤버 초대 링크(`?i=CODE`)로 들어오면 코드를 미리 채운다. 손으로
  // 옮겨 적으라고 하면 대부분 안 적고, 그러면 그 멤버 성과가 안 잡힌다
  const [invite, setInvite] = useState(p.invite ?? "");
  /**
   * 초대 확인 결과. **금액이 여기 달려 있다** — 유효한 코드면 게스트가로
   * 바뀐다. 최종 금액은 서버가 다시 정하므로 여기 값은 보여 주기용이다.
   */
  const [inviteOk, setInviteOk] = useState<null | {
    valid: boolean;
    price: number | null;
  }>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  const gcap = genderCap(p.capacity);
  const leftF = p.genderBalanced ? gcap - p.bookedF : p.capacity - p.booked;
  const leftM = p.genderBalanced ? gcap - p.bookedM : p.capacity - p.booked;

  // 타이핑할 때마다 부르면 글자 수만큼 왕복한다. 멈추고 나서 한 번만
  useEffect(() => {
    const code = invite.trim();
    if (!code) {
      setInviteOk(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: p.eventId, code }),
        });
        setInviteOk(await res.json());
      } catch {
        setInviteOk(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [invite, p.eventId]);

  const guestPrice =
    inviteOk?.valid && inviteOk.price != null ? inviteOk.price : null;

  const tier = p.tiers.find((t) => t.id === tierId) ?? null;
  const unit = useMemo(() => {
    if (!tier || !gender) return null;
    if (guestPrice != null) return guestPrice;
    return priceFor(tier.price, gender, p.maleMultiplier, tier.male_price);
  }, [tier, gender, p.maleMultiplier, guestPrice]);
  const total = unit ? unit * qty : null;

  // **번호가 말이 되는지까지 본다.** 예전에는 비어 있지만 않으면
  // 통과해서, 아무 글자나 적고 자리를 잡을 수 있었다 — 그러면 입금을
  // 확인하려 해도 연락할 데가 없다
  const ready = Boolean(tierId && gender && name.trim() && phoneOk(phone));

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

  /**
   * **이미 예매한 사람에게는 폼을 안 연다.**
   *
   * 서버가 어차피 거절하지만, 그 전에 이름·번호·성별·인원을 다 채우게
   * 하고 마지막에 막는 건 화나는 일이다. 여기서 바로 티켓으로 보낸다.
   */
  if (p.mine) {
    return (
      <div className="flex flex-none items-center gap-3 border-t border-line bg-white px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5">
        <div className="flex-1">
          <small className="block text-xs text-sub">이미 예매했어요</small>
          <b className="text-lg font-extrabold">{p.mine}</b>
        </div>
        <a
          href="/tickets"
          className="rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white"
        >
          내 티켓
        </a>
      </div>
    );
  }

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
          onClick={() => {
            if (!p.signedIn) {
              let asked = false;
              try {
                asked = sessionStorage.getItem("pm_login_asked") === "1";
              } catch {
                asked = true;
              }
              if (!asked) {
                try {
                  sessionStorage.setItem("pm_login_asked", "1");
                } catch {
                  // 무시
                }
                setAskLogin(true);
                return;
              }
            }
            setOpen(true);
          }}
          className="rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white disabled:bg-[#C8CBD2]"
        >
          {disabled ? "마감" : "예매하기"}
        </button>
      </div>

      {askLogin ? (
        <div
          onClick={() => setAskLogin(false)}
          role="presentation"
          className="absolute inset-0 z-20 flex items-end bg-[#0a0c10]/45 sm:items-center sm:justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="로그인 안내"
            className="w-full rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-[360px] sm:rounded-3xl"
          >
            <b className="block text-[19px] font-extrabold leading-snug">
              로그인하면
              <br />
              티켓을 잃어버리지 않아요
            </b>
            <ul className="mt-3.5 text-[13.5px] leading-7 text-sub">
              <li>· 기기를 바꿔도 티켓이 따라와요</li>
              <li>· 입금이 확인되면 알림으로 알려 드려요</li>
              <li>· 이름·연락처를 다시 안 적어도 돼요</li>
            </ul>

            <a
              href={`/login?next=${encodeURIComponent(p.loginNext ?? "/")}`}
              className="mt-5 block rounded-xl bg-brand py-3.5 text-center text-base font-bold text-white"
            >
              로그인하고 예매
            </a>
            <button
              type="button"
              onClick={() => {
                setAskLogin(false);
                setOpen(true);
              }}
              className="mt-2.5 w-full rounded-xl border border-line py-3.5 text-[15px] font-semibold text-sub"
            >
              비로그인으로 예매하기
            </button>
            <p className="mt-3 text-center text-[12px] leading-relaxed text-sub">
              로그인 안 해도 예매됩니다. 나중에 이름과 연락처로 찾을 수 있어요.
            </p>
          </div>
        </div>
      ) : null}

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
            // 호스트가 닫았으면 자리가 남아도 못 산다
            const out = Boolean(t.closed_at) || sold >= t.capacity;
            const price =
              guestPrice ??
              priceFor(t.price, gender ?? "F", p.maleMultiplier, t.male_price);
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
              onChange={(e) => setPhone(phoneMask(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full rounded-xl border-[1.5px] border-transparent bg-soft p-3.5 text-[15.5px] outline-none focus:border-brand focus:bg-white"
            />
            {/* 다 치기 전에 빨간 글씨를 띄우면 치는 내내 틀렸다고 한다 */}
            {phone.trim() && !phoneOk(phone) ? (
              <p className="mt-1.5 text-[12.5px] text-hot">
                번호를 다시 확인해 주세요. 해외 번호는 +부터 적어 주세요.
              </p>
            ) : (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-sub">
                입금 확인과 당일 안내를 이 번호로 보냅니다.
              </p>
            )}
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
              placeholder="DJ · 호스트에게 받은 코드"
              className={`w-full rounded-xl border-[1.5px] bg-soft p-3.5 text-[15.5px] uppercase outline-none focus:bg-white ${
                inviteOk?.valid
                  ? "border-ok"
                  : inviteOk && !inviteOk.valid
                    ? "border-hot"
                    : "border-transparent focus:border-brand"
              }`}
            />
            {/* **뭔지 모르면 아무도 안 넣는다.** 어디서 받는 것인지,
                넣으면 뭐가 달라지는지를 그 자리에 적는다 */}
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-sub">
              {checking
                ? "확인 중…"
                : inviteOk?.valid && guestPrice != null
                  ? `게스트가 적용 — ${won(guestPrice)}`
                  : inviteOk?.valid
                    ? "확인됐어요. 누가 초대했는지 집계에 들어갑니다."
                    : inviteOk && !inviteOk.valid
                      ? "그런 코드가 없어요. 비워 두셔도 예매됩니다."
                      : "DJ 나 호스트에게 받은 코드를 넣으면 게스트 가격이 적용돼요."}
            </p>
          </div>
          {/* 스크롤 끝이 안내 문구에 바로 붙으면 위 입력칸이 잘린 것처럼
              보인다. 한 칸 띄운다 */}
          <div className="h-4" />
        </div>

        {/* **누르기 전에 보여 준다.** 결제하고 나서 알려 주면 그게
            분쟁이 된다 */}
        <p className="border-t border-line px-4 pb-2 pt-2.5 text-[12px] leading-relaxed text-sub">
          {`신청 후 ${HOLD_HOURS}시간 안에 입금하지 않으면 자동 취소돼요. 파티 ${REFUND_CUTOFF_DAYS}일 전부터는 환불되지 않습니다.`}
        </p>

        {err ? (
          <p className="px-4 pb-2 text-[13px] font-semibold text-hot">{err}</p>
        ) : null}

        <div className="flex items-center gap-3 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-1">
          <div className="flex-1">
            <small className="block text-xs text-sub">총 결제금액</small>
            {total ? (
              <b className="text-lg font-extrabold">{won(total)}</b>
            ) : (
              /* 값이 없으면 "—" 대신 뭘 해야 하는지 적는다. 대시만 있으면
                 버튼이 왜 안 눌리는지 알 수 없다 */
              <b className="text-[13.5px] font-semibold text-sub">
                {!tierId
                  ? "차수를 골라 주세요"
                  : !gender
                    ? "성별을 골라 주세요"
                    : !name.trim()
                      ? "이름을 적어 주세요"
                      : "연락처를 적어 주세요"}
              </b>
            )}
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
