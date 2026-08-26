"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * 크루·운영 로그인.
 *
 * **구글이 먼저다.** 현장에서 스태프 여럿이 각자 폰으로 들어가는데
 * 비밀번호를 단톡방에 돌리게 되면 그게 그대로 명단 접근 권한이 된다.
 * 구글은 각자 자기 계정으로 들어간다.
 *
 * 이메일·비밀번호는 **지금 꺼 둔다.** Supabase 에서 Email provider 를
 * 껐기 때문에 눌러도 "Email logins are disabled" 만 뜬다. 되는 척하는
 * 버튼이 제일 나쁘다 — 손님은 앱이 고장 난 줄 안다.
 * 대시보드에서 다시 켜면 아래 EMAIL_LOGIN 만 true 로 바꾸면 된다.
 */
const EMAIL_LOGIN = false;
export function LoginForm({ next = "/crew" }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "password" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function google() {
    setBusy("google");
    setErr(null);
    const supabase = createClient();
    // 게스트로 들어와 있던 익명 세션을 먼저 끊는다. 안 그러면 익명 계정과
    // 크루 계정이 섞여 RLS 가 엉뚱한 걸 본다
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setErr(
        error.message.includes("not enabled")
          ? "구글 로그인이 아직 준비 중이에요."
          : error.message,
      );
      setBusy(null);
    }
  }

  async function login() {
    setBusy("password");
    setErr(null);
    const supabase = createClient();
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setErr(
        error.message.includes("Invalid login")
          ? "이메일이나 비밀번호가 맞지 않아요."
          : error.message,
      );
      setBusy(null);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={busy !== null}
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
        {busy === "google" ? "이동 중…" : "구글로 로그인"}
      </button>

      {err ? (
        <p className="mt-2.5 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}

      {!EMAIL_LOGIN ? null : !showPw ? (
        <button
          type="button"
          onClick={() => setShowPw(true)}
          className="mt-4 w-full text-center text-[13px] text-sub underline"
        >
          이메일로 로그인
        </button>
      ) : (
        <div className="mt-5 border-t border-line pt-5">
          <input
            value={email}
            type="email"
            inputMode="email"
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="crew@example.com"
            className="mb-2 w-full rounded-xl bg-soft p-3.5 text-[15.5px] outline-none focus:bg-white focus:ring-2 focus:ring-brand"
          />
          <input
            value={password}
            type="password"
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void login();
            }}
            placeholder="비밀번호"
            className="w-full rounded-xl bg-soft p-3.5 text-[15.5px] outline-none focus:bg-white focus:ring-2 focus:ring-brand"
          />
          <button
            type="button"
            disabled={
              busy !== null || !email.includes("@") || password.length < 6
            }
            onClick={login}
            className="mt-3 w-full rounded-xl bg-brand py-3.5 text-base font-bold text-white disabled:bg-[#C8CBD2]"
          >
            {busy === "password" ? "들어가는 중…" : "로그인"}
          </button>
        </div>
      )}

      <p className="mt-5 text-[12.5px] leading-relaxed text-sub">
        크루로 등록된 계정만 들어갑니다.{" "}
        <a href="/my/crew-apply" className="underline">
          크루 신청
        </a>{" "}
        은 여기서 받습니다.
      </p>
    </>
  );
}
