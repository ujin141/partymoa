"use client";

import { isNativeIOS, nativePushToken } from "@/lib/native";

/**
 * 알림 켜기. **웹과 앱이 가는 길이 다르다.**
 *
 *   웹   브라우저에 구독을 만들고(VAPID) 그 주소를 서버에 넘긴다
 *   앱   APNs 디바이스 토큰을 받아 그걸 서버에 넘긴다
 *
 * 두 화면(알림 설정 · 시작 화면)이 같은 일을 해서 여기 한 벌만 둔다.
 * 두 벌로 두면 한쪽만 고치는 날이 반드시 온다.
 */
export type EnablePush =
  | { ok: true }
  /** 손님이 거부했다. 설정에 들어가야 풀린다 */
  | { ok: false; reason: "denied" }
  /** 아이폰 사파리 — 홈 화면에 추가해야 알림이 생긴다 */
  | { ok: false; reason: "install" }
  /** 이 브라우저는 알림 자체가 없다 */
  | { ok: false; reason: "unsupported" }
  /** 애플·구글 쪽에 등록이 안 됐다. 다시 누르면 되는 경우가 많다 */
  | { ok: false; reason: "register" }
  | { ok: false; reason: "error"; message: string };

/** VAPID 공개키는 base64url. 브라우저는 Uint8Array 를 받는다 */
function toBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function save(body: unknown) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).message);
}

export async function enablePush(vapid: string): Promise<EnablePush> {
  try {
    if (isNativeIOS()) {
      const r = await nativePushToken();
      if (!("token" in r)) {
        // 원인마다 손님이 할 일이 다르다. 하나로 뭉쳐 두면 아무것도
        // 못 하는 안내가 된다
        if (r.error === "denied") return { ok: false, reason: "denied" };
        if (r.error === "register") return { ok: false, reason: "register" };
        return { ok: false, reason: "unsupported" };
      }
      await save({ endpoint: r.token, platform: "ios" });
      return { ok: true };
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // 아이폰 사파리는 홈 화면에 추가해야 PushManager 가 생긴다
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      return { ok: false, reason: ios && !standalone ? "install" : "unsupported" };
    }
    if (Notification.permission === "denied") {
      return { ok: false, reason: "denied" };
    }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      return { ok: false, reason: perm === "denied" ? "denied" : "error", message: "" };
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(vapid),
    });
    await save(sub.toJSON());
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "알림을 켜지 못했어요.",
    };
  }
}
