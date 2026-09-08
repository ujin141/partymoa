"use client";

import { useTransition } from "react";

import { signOut } from "@/app/auth/actions";

async function dropPush() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

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
        start(async () => {
          // 이 기기의 알림 구독을 먼저 끊는다. 안 끊으면 다음 사람이 이 폰을
          // 쓸 때 "입금 확인됐어요 · PM0012" 가 계속 뜬다
          await dropPush().catch(() => null);
          await signOut(to);
        });
      }}
      className={className}
    >
      {busy ? "나가는 중…" : children}
    </button>
  );
}
