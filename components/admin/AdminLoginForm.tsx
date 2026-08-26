"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * 운영자 로그인 — **구글만 받는다.**
 *
 * 크루 로그인에는 이메일·비밀번호가 남아 있다. 크루는 스태프가 여럿이고
 * 구글 계정이 없는 사람도 있어서다. 운영자는 다르다 — 전 크루의 매출과
 * 손님 명단을 보는 자리라 비밀번호를 돌릴 여지를 아예 두지 않는다.
 */
export function AdminLoginForm() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    // 게스트로 들어와 있던 익명 세션을 먼저 끊는다. 안 그러면 익명 계정과
    // 운영자 계정이 섞여 RLS 가 엉뚱한 걸 본다
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/admin` },
    });
    if (error) {
      setErr(
        error.message.includes("not enabled")
          ? "구글 로그인이 아직 준비 중이에요."
          : error.message,
      );
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={google}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white py-3.5 text-[15px] font-bold text-[#1F1F1F] disabled:opacity-50"
      >
        <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M45.1 24.5c0-1.6-.14-3.14-.4-4.63H24v8.76h11.83c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.55-9.47 6.55-16.29z"
          />
          <path
            fill="#34A853"
            d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
          />
          <path
            fill="#FBBC05"
            d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A22 22 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
          />
          <path
            fill="#EA4335"
            d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.94 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"
          />
        </svg>
        {busy ? "이동 중…" : "구글로 로그인"}
      </button>
      {err ? (
        <p className="mt-2.5 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
    </>
  );
}
