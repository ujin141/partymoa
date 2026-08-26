"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * 계정 삭제 버튼.
 *
 * **한 번 더 묻는다.** 되돌릴 수 없고, 지우고 나면 티켓 목록도 같이
 * 사라진다. 잘못 눌러서 지워지는 게 제일 나쁘다.
 *
 * 지우고 나면 세션이 없어지므로 홈으로 보낸다.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setStep("done");
    setBusy(false);
    router.refresh();
  }

  if (step === "done") {
    return (
      <p className="rounded-xl bg-[#E7F7EF] px-4 py-3.5 text-[13.5px] font-semibold leading-relaxed text-ok">
        계정을 지웠습니다. 이용해 주셔서 고마웠어요.
      </p>
    );
  }

  if (step === "confirm") {
    return (
      <div className="rounded-xl border border-hot p-4">
        <b className="block text-[14.5px] text-hot">정말 지울까요?</b>
        <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
          되돌릴 수 없습니다. 내 티켓 목록도 같이 사라집니다.
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="rounded-xl border border-line py-3 text-[14px] font-semibold text-sub"
          >
            그만두기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="rounded-xl bg-hot py-3 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "지우는 중…" : "지웁니다"}
          </button>
        </div>
        {err ? (
          <p className="mt-2.5 text-[13px] font-semibold text-hot">{err}</p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("confirm")}
      className="w-full rounded-xl border border-hot py-3.5 text-[15px] font-bold text-hot"
    >
      계정 삭제
    </button>
  );
}
