import "server-only";

import webpush from "web-push";

/**
 * 웹 푸시 보내기.
 *
 * **키가 없으면 조용히 안 보낸다.** 예매·입금 같은 진짜 일이 알림 때문에
 * 막히면 안 된다 — 알림은 곁다리다.
 */
export function pushReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

let set = false;
function configure() {
  if (set || !pushReady()) return pushReady();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@partymoa.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  set = true;
  return true;
}

export type Sub = { endpoint: string; p256dh: string; auth: string };

/** 보냈으면 true, 구독이 죽었으면 false (410/404) */
export async function sendPush(
  sub: Sub,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<boolean> {
  if (!configure()) return false;
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
