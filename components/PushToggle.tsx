"use client";

import { useEffect, useState } from "react";

/** VAPID 공개키는 base64url. 브라우저는 Uint8Array 를 받는다 */
function toBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "확인중" | "불가" | "꺼짐" | "켜짐" | "거부됨";

/**
 * 알림 켜기.
 *
 * **먼저 왜 필요한지 말하고 나서 묻는다.** 들어오자마자 권한 창을 띄우면
 * 대부분 차단을 누르고, 한 번 차단하면 브라우저 설정에 들어가야 풀린다 —
 * 사실상 영영 못 보낸다.
 *
 * 아이폰은 홈 화면에 추가한 뒤에만 푸시가 된다. 그 경우 안내를 다르게
 * 띄운다 — 안 되는 버튼을 눌러 보게 하지 않는다.
 */
export function PushToggle({ vapid }: { vapid: string }) {
  const [state, setState] = useState<State>("확인중");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    if (!vapid) {
      setState("불가");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // 아이폰 사파리는 홈 화면에 추가해야 PushManager 가 생긴다
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setIosNeedsInstall(ios && !standalone);
      setState("불가");
      return;
    }
    if (Notification.permission === "denied") {
      setState("거부됨");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "켜짐" : "꺼짐"))
      .catch(() => setState("꺼짐"));
  }, [vapid]);

  async function turnOn() {
    setBusy(true);
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "거부됨" : "꺼짐");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(vapid),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setState("켜짐");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "알림을 켜지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("꺼짐");
    } catch {
      setErr("알림을 끄지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "확인중") {
    return <div className="h-[52px] rounded-xl bg-soft" />;
  }

  if (state === "불가") {
    return (
      <p className="rounded-xl bg-soft p-4 text-[13px] leading-7 text-sub">
        {iosNeedsInstall
          ? "아이폰은 홈 화면에 추가한 뒤에 알림을 켤 수 있어요. 사파리에서 공유 → 홈 화면에 추가를 누르고 다시 들어와 주세요."
          : "이 브라우저는 알림을 지원하지 않아요."}
      </p>
    );
  }

  if (state === "거부됨") {
    return (
      <p className="rounded-xl bg-[#FDECEF] p-4 text-[13px] leading-7 text-hot">
        브라우저에서 알림이 차단돼 있어요. 주소창 옆 자물쇠에서 알림을 허용으로
        바꾸면 다시 켤 수 있어요.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={state === "켜짐" ? turnOff : turnOn}
        className={`w-full rounded-xl py-4 text-base font-bold disabled:opacity-60 ${
          state === "켜짐"
            ? "border border-line bg-white text-sub"
            : "bg-brand text-white"
        }`}
      >
        {busy ? "잠시만요…" : state === "켜짐" ? "알림 끄기" : "알림 켜기"}
      </button>
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
    </>
  );
}
