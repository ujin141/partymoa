/**
 * 안내 카드에 넣을 앱 화면을 찍는다.
 *
 *   node scripts/shots.mjs
 *
 * ## 왜 스크립트인가
 *
 * 그냥 헤드리스 크롬으로 주소만 열면 **온보딩 화면만 찍힌다.** 처음 들어온
 * 사람에게는 어느 주소든 온보딩이 먼저 덮기 때문이다. 넘기려면 클릭이
 * 필요하고, 클릭하려면 브라우저를 몰아야 한다.
 *
 * 시스템에 깔린 크롬을 쓴다 — playwright-core 만 받고 브라우저는 안 받는다.
 *
 * 찍은 그림은 **blackout/video/assets/shots** 로 나간다. 포스터를 만드는
 * 쪽이 거기라서다.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const SITE = process.env.SHOT_SITE ?? "https://www.partymoa.com";
const OUT = path.resolve(
  process.cwd(),
  "..",
  "blackout",
  "video",
  "assets",
  "shots",
);

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));

if (!CHROME) throw new Error("크롬을 못 찾았습니다.");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});

/**
 * 온보딩을 끝까지 넘긴다.
 *
 * 한 번에 못 넘긴다 — 스플래시 → 슬라이드 몇 장 → 취향 고르기 순서라
 * 단계마다 눌러야 할 게 다르다. 보이는 것부터 차례로 누른다.
 */
async function skipTour() {
  for (let i = 0; i < 8; i += 1) {
    const gate = page.locator(".z-50").first();
    if (!(await gate.isVisible().catch(() => false))) return;

    for (const name of ["나중에 고를게요", "시작하기", "건너뛰기"]) {
      const b = page.getByRole("button", { name, exact: true }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => {});
        await page.waitForTimeout(600);
        break;
      }
      // 스플래시는 화면 전체가 버튼이다. 아무 데나 눌러 다음으로
      if (name === "건너뛰기") {
        await gate.click({ position: { x: 215, y: 500 } }).catch(() => {});
        await page.waitForTimeout(600);
      }
    }
  }
}

async function shot(name, url, prep) {
  await page.goto(`${SITE}${url}`, { waitUntil: "networkidle" });
  await skipTour();
  if (prep) await prep();
  await page.waitForTimeout(700);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}

await shot("home", "/");
await shot("party", "/party/after-sunset-20260829");

// 예매 시트는 버튼을 눌러야 열린다. 손님이 제일 헷갈려 하는 화면이라
// 안내에 반드시 들어가야 한다
await shot("book", "/party/after-sunset-20260829", async () => {
  const cta = page.getByRole("button", { name: "예매하기" }).first();
  await cta.click();
  await page.waitForTimeout(900);
});

// 로그인 선택을 지나 실제 입력 화면까지. **여기가 손님이 제일 헷갈려
// 하는 자리다** — 이름·연락처를 어디에 넣는지가 안내의 핵심이다
await shot("form", "/party/after-sunset-20260829", async () => {
  await page.getByRole("button", { name: "예매하기" }).first().click();
  await page.waitForTimeout(900);
  const guest = page.getByRole("button", { name: /비로그인/ }).first();
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
    await page.waitForTimeout(900);
  }
});

await shot("tickets", "/tickets");

await browser.close();
