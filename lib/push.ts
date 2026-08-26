import "server-only";

import webpush from "web-push";

import { apnsReady, sendApns } from "./apns";

/**
 * 푸시 보내기. 기기 종류에 따라 갈린다.
 *
 *   web   브라우저 구독 — VAPID 로 서명해 브라우저 푸시 서버에 넣는다
 *   ios   아이폰 앱     — .p8 로 서명해 APNs 에 넣는다 (lib/apns.ts)
 *
 * **키가 없으면 조용히 안 보낸다.** 예매·입금 같은 진짜 일이 알림 때문에
 * 막히면 안 된다 — 알림은 곁다리다. 한쪽 키만 있어도 그쪽은 나간다.
 */
export function pushReady() {
  return webPushReady() || apnsReady();
}

function webPushReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

let set = false;
function configure() {
  if (set || !webPushReady()) return webPushReady();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@partymoa.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  set = true;
  return true;
}

export type Sub = {
  endpoint: string;
  // iOS 행에는 없다. endpoint 가 APNs 디바이스 토큰이다
  p256dh?: string | null;
  auth?: string | null;
  platform?: string | null;
};

/** 보냈으면 true, 구독이 죽었으면 false (410/404) */
export async function sendPush(
  sub: Sub,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<boolean> {
  if (sub.platform === "ios") return sendApns(sub.endpoint, payload);

  if (!configure()) return false;
  if (!sub.p256dh || !sub.auth) return false;   // 웹 구독인데 키가 없다 — 못 보낸다
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    // 410 Gone · 404 — 기기에서 지운 구독이다. 지워도 된다
    if (code === 410 || code === 404) return false;
    console.error("[push] 실패", code);
    return true; // 일시적 오류는 구독을 죽이지 않는다
  }
}
