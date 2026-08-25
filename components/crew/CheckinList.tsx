"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { setCheckedIn } from "@/app/(crew)/crew/actions";
import { Gauge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import type { Booking } from "@/types/database";

/**
 * 입장 확인. 사양서 6절.
 *
 * 현장에서 실제로 쓰는 화면이라 세 가지를 신경 썼다.
 *
 *   1. **미입금을 그냥 통과시키지 않는다.** 현장 사고 1순위다(3-3).
 *   2. **번호 뒷자리만 쳐도 찾는다.** 줄이 밀리는데 'PM0007' 을 다 치게
 *      하면 안 된다. '7' 만 쳐도 PM0007 이 나온다.
 *   3. **다른 스태프가 처리한 게 바로 보인다.** 입구에 둘이 서면 반드시
 *      겹친다. Realtime 으로 같은 행사를 구독해 서로의 처리를 반영한다.
 *
 * 그리고 되돌리기. 잘못 눌렀을 때 명단 탭으로 넘어가 찾게 하면 줄이 선다.
 */
export function CheckinList({
  bookings,
  eventId,
}: {
  bookings: Booking[];
  eventId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const [last, setLast] = useState<Booking | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 다른 스태프의 처리를 받아 온다
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`checkin:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `event_id=eq.${eventId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [eventId, router]);

  const rows = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    // 숫자만 쳤으면 예매번호 뒷자리로 본다 — '7' → PM0007
    const digits = needle.replace(/\D/g, "");
    return rows.filter((b) => {
      if (`${b.name}${b.phone}${b.code}`.toLowerCase().includes(needle))
        return true;
      return digits.length > 0 && b.code.replace(/\D/g, "").endsWith(digits);
    });
  }, [rows, q]);

  const total = rows.reduce((a, b) => a + b.quantity, 0);
  const inside = rows
    .filter((b) => b.status === "checked_in")
    .reduce((a, b) => a + b.quantity, 0);

  function toggle(b: Booking) {
    const goingIn = b.status !== "checked_in";
    if (goingIn && b.status === "pending") {
      const ok = window.confirm(
        `${b.name}님은 미입금 상태예요.\n그래도 입장 처리할까요?`,
      );
      if (!ok) return;
    }
    start(async () => {
      await setCheckedIn(b.id, goingIn);
      if (goingIn) {
        setLast(b);
        // 다음 손님을 위해 검색창을 비우고 커서를 돌려 놓는다
        setQ("");
        inputRef.current?.focus();
      }
    });
  }

  return (
    <>
      <div className="flex items-baseline justify-between px-4 pb-3 pt-5">
        <h2 className="text-[19px] font-extrabold">입장 확인</h2>
        <span className="text-[13px] text-sub">
          입장 {inside}명 / 예매 {total}명
        </span>
      </div>

      <div className="px-4">
        <Gauge pct={total ? (inside / total) * 100 : 0} />
      </div>

      <div className="px-4 pt-3.5">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 또는 예매번호 뒷자리"
          autoComplete="off"
          className="w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-brand"
        />
        <p className="mt-1.5 text-[12px] text-sub">
          번호는 뒷자리만 쳐도 찾아요. 7 → PM0007
        </p>
      </div>

      {last ? (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-brand">
            {last.name} · {last.quantity}명 입장
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                await setCheckedIn(last.id, false);
                setLast(null);
              })
            }
            className="flex-none rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-brand"
          >
            되돌리기
          </button>
        </div>
      ) : null}

      <div className="pt-3">
        {shown.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-sub">
            검색 결과가 없어요.
          </p>
        ) : (
          shown.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 border-b border-line px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold">
                    {b.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      b.gender === "F"
                        ? "bg-[#FDE8EE] text-[#C2185B]"
                        : "bg-[#E4EEFB] text-[#1565C0]"
                    }`}
                  >
                    {b.gender === "F" ? "여" : "남"}
                  </span>
                  {b.quantity > 1 ? (
                    <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {b.quantity}명
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[12.5px] text-sub">{b.code}</div>
                <div
                  className={`mt-0.5 text-[12px] font-bold ${
                    b.status === "pending" ? "text-hot" : "text-ok"
                  }`}
                >
                  {b.status === "pending" ? "⚠ 미입금" : "입금 완료"}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(b)}
                className={`flex-none rounded-lg px-4 py-3 text-[13px] font-bold transition active:scale-95 ${
                  b.status === "checked_in"
                    ? "bg-brand text-white"
                    : b.status === "paid"
                      ? "bg-[#E7F7EF] text-ok"
                      : "bg-soft text-sub"
                }`}
              >
                {b.status === "checked_in" ? "입장 완료" : "입장 처리"}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="h-4" />
    </>
  );
}
