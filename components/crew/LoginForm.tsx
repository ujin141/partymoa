"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * 크루 로그인. **매직 링크가 아니라 비밀번호다.**
 *
 * 처음엔 매직 링크로 만들었는데, Supabase 기본 SMTP 는 시간당 2통이다.
 * 행사 당일 입구에서 스태프 세 명이 각자 폰으로 들어가야 하는 상황에
 * 메일이 안 오면 그날 장사를 못 한다. 커스텀 SMTP 를 붙이기 전까지는
 * 비밀번호가 맞다.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    // 게스트로 들어와 있던 익명 세션을 먼저 끊는다. 안 그러면 크루 계정과
    // 익명 계정이 섞여 RLS 가 엉뚱한 걸 본다
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
      setBusy(false);
      return;
    }
    router.push("/crew");
    router.refresh();
  }

  return (
    <>
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
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <button
        type="button"
        disabled={busy || !email.includes("@") || password.length < 6}
        onClick={login}
        className="mt-3 w-full rounded-xl bg-brand py-3.5 text-base font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "들어가는 중…" : "로그인"}
      </button>
      <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
        계정은 파티모아가 발급합니다. 크루 등록 문의는 인스타 DM 으로 주세요.
      </p>
    </>
  );
}
