"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * 이메일·비밀번호 로그인.
 *
 * **손님을 위한 문이 아니다.** 이 앱의 로그인은 구글 하나뿐이고 그게
 * 맞다 — 비밀번호를 하나 더 만들게 하는 건 손님에게 부담만 준다.
 *
 * 이 문이 필요한 이유는 하나다. 스토어 심사자가 크루 화면을 열어 봐야
 * 하는데, 구글 계정밖에 없으면 **진짜 구글 계정의 비밀번호를 통째로
 * 넘겨야 한다.** 그 계정은 메일·드라이브까지 다 열리고, 심사가 끝나도
 * 회수할 방법이 마땅치 않다. 심사 전용 계정 하나만 주고 끝나면 지우는
 * 쪽이 낫다.
 *
 * 그래서 **접어 둔다.** 링크를 눌러야 열린다. 모르는 사람은 평생 안
 * 본다.
 *
 * ⚠ Supabase 대시보드에서 이메일 **가입은 꺼 두어야 한다**
 * (Authentication → Providers → Email → Allow new users to sign up).
 * 여기서는 signUp 을 절대 부르지 않지만, 열려 있으면 API 로 직접
 * 가입할 수 있다.
 */
export function PasswordLogin({ next = "/my" }: { next?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const supabase = createClient();

    // 익명 세션을 먼저 끊는다. 안 끊으면 새 로그인이 옛 세션과 섞인다
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.is_anonymous) await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pw,
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

    // 서버 컴포넌트가 새 쿠키를 보게 한다. 없으면 로그인하고도 로그인
    // 화면이 그대로 남는다
    router.replace(next);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full py-2 text-center text-[13px] text-sub underline"
      >
        이메일로 로그인
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-2.5">
      <input
        type="email"
        required
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일"
        className="rounded-xl bg-soft px-4 py-3.5 text-[15px] outline-none"
      />
      <input
        type="password"
        required
        autoComplete="current-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="비밀번호"
        className="rounded-xl bg-soft px-4 py-3.5 text-[15px] outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "확인 중…" : "로그인"}
      </button>
      {err ? (
        <p className="text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <p className="text-center text-[12px] leading-relaxed text-sub">
        따로 발급받은 계정이 있을 때만 씁니다. 새로 가입되지 않아요.
      </p>
    </form>
  );
}
