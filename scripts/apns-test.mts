/**
 * APNs 한 통 쏴 보기.
 *
 *   node --experimental-strip-types scripts/apns-test.mts <디바이스토큰>
 *
 * **실제 lib/apns.ts 를 그대로 쓴다.** 여기서 따로 구현하면 스크립트만
 * 되고 앱은 안 되는 상황을 못 잡는다.
 *
 * 값은 .env.local 에서 읽는다. 없으면 무엇이 없는지 알려 준다.
 * APNS_PRODUCTION 은 빌드에 맞춰야 한다 —
 *   TestFlight · 앱스토어 → true
 *   Xcode 로 직접 설치     → false
 * 어긋나면 BadDeviceToken 이 온다.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(import.meta.dirname);

// .env.local 을 손으로 읽는다. next 없이 도는 스크립트다
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && v[0] === '"' && v.at(-1) === '"') v = v.slice(1, -1);
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}

const token = process.argv[2];
if (!token) {
  console.error("사용법: node --experimental-strip-types scripts/apns-test.mts <디바이스토큰>");
  console.error("토큰은 Supabase > push_subscriptions 에서 platform = 'ios' 인 행의 endpoint 다.");
  process.exit(1);
}

const missing = ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_PRIVATE_KEY"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(`.env.local 에 없는 값: ${missing.join(", ")}`);
  console.error("Vercel 에 넣은 것과 같은 값을 .env.local 에도 넣어야 여기서 돌아간다.");
  process.exit(1);
}

const prod = process.env.APNS_PRODUCTION === "true";
console.log(`APNs ${prod ? "운영(api.push.apple.com)" : "개발(sandbox)"} 으로 보낸다`);
console.log(`토큰 ${token.slice(0, 8)}…${token.slice(-4)} (${token.length}자)`);

const { sendApns } = await import("../lib/apns.ts");

const ok = await sendApns(token, {
  title: "파티모아 테스트",
  body: "이 알림이 보이면 APNs 가 연결된 것입니다.",
  url: "/tickets",
  tag: "apns-test",
});

// sendApns 는 "구독이 살아 있나" 를 돌려준다. 보냈는지와는 다르다 —
// 콘솔에 [apns] 실패 가 찍혔는지도 같이 봐야 한다
console.log(
  ok
    ? "보냈다. 폰에 안 뜨면 위에 [apns] 실패 로그가 있는지 보라."
    : "토큰이 죽었다 (410/BadDeviceToken). 앱을 지웠거나 개발↔운영이 어긋났다.",
);
