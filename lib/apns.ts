import "server-only";

import { createSign } from "node:crypto";
import http2 from "node:http2";

/**
 * 아이폰 앱으로 푸시 보내기.
 *
 * **fetch 로는 안 된다.** APNs 는 HTTP/2 만 받는데 Node 의 fetch 는
 * HTTP/1.1 로 나간다. node:http2 를 직접 쓴다.
 *
 * **키가 없으면 조용히 안 보낸다.** 웹푸시 쪽과 같은 규칙이다 —
 * 알림은 곁다리고, 예매 같은 진짜 일이 막히면 안 된다.
 *
 * 필요한 환경변수 넷. Apple Developer 계정에서 받는다.
 *   APNS_KEY_ID       키 ID (10자)
 *   APNS_TEAM_ID      팀 ID (10자)
 *   APNS_PRIVATE_KEY  .p8 파일 내용 통째로
 *   APNS_PRODUCTION   앱스토어·테스트플라이트 빌드면 "true"
 */
const HOST_PROD = "https://api.push.apple.com";
const HOST_DEV = "https://api.sandbox.push.apple.com";

const BUNDLE_ID = "com.partymoa.app";

export function apnsReady() {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_PRIVATE_KEY,
  );
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * 토큰은 최대 한 시간을 쓸 수 있고, **20분보다 자주 새로 만들면 APNs 가
 * 429 로 막는다.** 그래서 들고 있다가 50분마다 새로 만든다.
 */
let cached: { jwt: string; at: number } | null = null;

function token() {
  const now = Date.now();
  if (cached && now - cached.at < 50 * 60 * 1000) return cached.jwt;

  const header = b64url(
    JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }),
  );
  const payload = b64url(
    JSON.stringify({
      iss: process.env.APNS_TEAM_ID,
      iat: Math.floor(now / 1000),
    }),
  );

  // 환경변수에 줄바꿈이 \n 문자열로 들어오는 경우가 많다
  const key = (process.env.APNS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const sig = createSign("SHA256")
    .update(`${header}.${payload}`)
    .sign({ key, dsaEncoding: "ieee-p1363" });   // ES256 은 DER 이 아니라 R||S 다

  const jwt = `${header}.${payload}.${b64url(sig)}`;
  cached = { jwt, at: now };
  return jwt;
}

export type ApnsPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** 보냈으면 true, 토큰이 죽었으면 false (410 · 400 BadDeviceToken) */
export async function sendApns(
  deviceToken: string,
  p: ApnsPayload,
): Promise<boolean> {
  if (!apnsReady()) return false;

  const host =
    process.env.APNS_PRODUCTION === "true" ? HOST_PROD : HOST_DEV;

  const body = JSON.stringify({
    aps: {
      alert: { title: p.title, body: p.body },
      sound: "default",
      // 같은 예매로 두 번 뜨면 잔소리가 된다 — 웹 쪽 tag 와 같은 뜻
      "thread-id": p.tag ?? "partymoa",
    },
    url: p.url ?? "/tickets",
  });

  return new Promise((resolve) => {
    const client = http2.connect(host);
    // 연결이 안 되면 알림 하나 못 보낸 것으로 끝낸다. 구독은 살려 둔다
    client.on("error", () => {
      client.close();
      resolve(true);
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${token()}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      // 마감 임박 알림은 늦게 가면 의미가 없다
      "apns-priority": "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    let status = 0;
    let text = "";
    req.on("response", (h) => {
      status = Number(h[":status"] ?? 0);
    });
    req.on("data", (c) => {
      text += c;
    });
    req.on("end", () => {
      client.close();
      if (status === 200) return resolve(true);

      // 410 Unregistered — 앱을 지웠다. 400 BadDeviceToken — 토큰이 틀렸다.
      // 둘 다 이 행을 지워야 한다
      const gone =
        status === 410 ||
        (status === 400 && text.includes("BadDeviceToken"));
      if (!gone) console.error("[apns] 실패", status, text);
      resolve(!gone);
    });
    req.on("error", () => {
      client.close();
      resolve(true);
    });

    req.end(body);
  });
}
