/**
 * Sign in with Apple 의 Client Secret(JWT) 만들기.
 *
 *   node --experimental-strip-types scripts/apple-secret.mts ~/Downloads/AuthKey_XXXXXXXXXX.p8
 *
 * Supabase 의 Apple provider 는 `.p8` 을 그대로 받지 않고 이걸로 서명한
 * JWT 를 요구한다. 애플이 정한 형식이라 손으로 만들 수는 없다.
 *
 * **키 파일은 이 컴퓨터 밖으로 나가지 않는다.** 읽어서 서명만 하고 버린다.
 *
 * **6개월마다 다시 만들어야 한다.** 애플이 유효기간 상한을 6개월로
 * 막아 뒀다. 만료되면 애플 로그인만 조용히 안 되고 다른 로그인은 멀쩡해서
 * 알아채기까지 오래 걸린다 — 달력에 적어 두는 편이 낫다.
 */
import fs from "node:fs";
import { createSign } from "node:crypto";

const TEAM_ID = "94XAL28D97";
const SERVICES_ID = "io.partymoa.signin";

const p8Path = process.argv[2];
if (!p8Path) {
  console.error("사용법: node --experimental-strip-types scripts/apple-secret.mts <.p8 경로>");
  process.exit(1);
}
if (!fs.existsSync(p8Path)) {
  console.error(`파일이 없다: ${p8Path}`);
  process.exit(1);
}

// 파일 이름에서 Key ID 를 뽑는다. 애플이 AuthKey_XXXXXXXXXX.p8 로 준다
const m = /AuthKey_([A-Z0-9]{10})\.p8$/i.exec(p8Path);
const keyId = m?.[1] ?? process.argv[3];
if (!keyId) {
  console.error("Key ID 를 못 찾았다. 두 번째 인자로 넣어라 (10자).");
  process.exit(1);
}

const b64url = (v: Buffer | string) =>
  Buffer.from(v).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const now = Math.floor(Date.now() / 1000);
const SIX_MONTHS = 15777000;          // 애플이 정한 상한

const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
const payload = b64url(
  JSON.stringify({
    iss: TEAM_ID,
    iat: now,
    exp: now + SIX_MONTHS,
    aud: "https://appleid.apple.com",
    sub: SERVICES_ID,
  }),
);

const sig = createSign("SHA256")
  .update(`${header}.${payload}`)
  .sign({ key: fs.readFileSync(p8Path, "utf8"), dsaEncoding: "ieee-p1363" });

console.log(`Team ID      ${TEAM_ID}`);
console.log(`Key ID       ${keyId}`);
console.log(`Services ID  ${SERVICES_ID}   ← Supabase 의 Client IDs 에 넣는다`);
console.log(`만료         ${new Date((now + SIX_MONTHS) * 1000).toISOString().slice(0, 10)}`);
console.log("\n── Secret Key (아래 한 줄을 통째로 복사) ──\n");
console.log(`${header}.${payload}.${b64url(sig)}`);
