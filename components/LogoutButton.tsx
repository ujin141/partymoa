"use client";

import { useTransition } from "react";

import { signOut } from "@/app/auth/actions";

export function LogoutButton({
  to = "/",
  confirm,
  className = "",
  children = "로그아웃",
}: {
  to?: string;
  /** 물어보고 나가야 할 때. 게스트는 티켓 연결이 끊기므로 필요하다 */
  confirm?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(() => void signOut(to));
      }}
      className={className}
    >
      {busy ? "나가는 중…" : children}
    </button>
  );
}
