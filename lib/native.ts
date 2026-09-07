/**
 * 아이폰 앱(Capacitor) 안인지 알아보고, 네이티브 기능을 부른다.
 *
 * **npm 패키지를 안 쓴다.** 앱은 배포된 주소를 그대로 띄우는 구조라
 * 웹 번들과 앱이 따로 논다. 플러그인 JS 를 웹에 넣으면 앱이 아닌
 * 브라우저에서도 딸려 내려가고, 버전이 어긋나면 그때 깨진다.
 * Capacitor 가 웹뷰에 넣어 주는 window.Capacitor 를 직접 부르는 편이
 * 얇고, 브라우저에서는 그냥 없는 값이라 알아서 꺼진다.
 */
type Plugin = Record<string, (...a: unknown[]) => Promise<unknown>>;

type Cap = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, Plugin>;
};

function cap(): Cap | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: Cap }).Capacitor ?? null;
}

/** 아이폰 앱 안에서 돌고 있나 */
export function isNativeIOS() {
  const c = cap();
  return Boolean(c?.isNativePlatform?.() && c.getPlatform?.() === "ios");
}

function plugin(name: string) {
  return cap()?.Plugins?.[name] ?? null;
}

/* ─────────────────────────────────────────── 알림 */

/**
 * 네이티브 알림 켜기. 성공하면 APNs 디바이스 토큰을 돌려준다.
 *
 * **등록은 비동기로 끝난다.** requestPermissions 가 끝나도 토큰은
 * 아직 없다 — register() 를 부르고 registration 이벤트를 기다려야 한다.
 * 안 오면 계속 매달려 있지 않고 포기한다.
 */
export type PushResult =
  | { token: string }
  /** 손님이 거부했다. 앱을 지웠다 깔지 않는 한 다시 못 묻는다 */
  | { error: "denied" }
  /** 애플에 등록이 안 됐다. 서명이 없거나 시뮬레이터거나 망이 끊겼다 */
  | { error: "register" }
  /** 플러그인이 앱에 안 들어갔다. 빌드 문제다 */
  | { error: "plugin" };

export function nativePushToken(timeoutMs = 15000): Promise<PushResult> {
  const p = plugin("PushNotifications");
  if (!p) return Promise.resolve({ error: "plugin" });

  return new Promise((resolve) => {
    let done = false;
    const finish = (v: PushResult) => {
      if (done) return;
      done = true;
      resolve(v);
    };

    const timer = setTimeout(() => finish({ error: "register" }), timeoutMs);

    (async () => {
      try {
        const perm = (await p.requestPermissions()) as { receive?: string };
        if (perm?.receive !== "granted") {
          clearTimeout(timer);
          return finish({ error: "denied" });
        }
        await (p as unknown as {
          addListener: (
            e: string,
            cb: (d: { value?: string; error?: string }) => void,
          ) => Promise<unknown>;
        }).addListener("registration", (d) => {
          clearTimeout(timer);
          finish(d?.value ? { token: d.value } : { error: "register" });
        });
        await (p as unknown as {
          addListener: (e: string, cb: () => void) => Promise<unknown>;
        }).addListener("registrationError", () => {
          clearTimeout(timer);
          finish({ error: "register" });
        });
        await p.register();
      } catch {
        clearTimeout(timer);
        // requestPermissions 조차 못 불렀다 — 플러그인이 안 붙은 것이다
        finish({ error: "plugin" });
      }
    })();
  });
}

/** 이미 허락했는지만 본다. 물어보지 않는다 */
export async function nativePushGranted(): Promise<boolean> {
  const p = plugin("PushNotifications");
  if (!p) return false;
  try {
    const s = (await p.checkPermissions()) as { receive?: string };
    return s?.receive === "granted";
  } catch {
    return false;
  }
}

/** 앱에 남은 등록을 지운다. 서버 쪽 행은 부른 쪽에서 지운다 */
export async function nativePushOff() {
  const p = plugin("PushNotifications");
  try {
    await p?.unregister();
  } catch {
    /* 이미 꺼져 있으면 그만이다 */
  }
}

/* ─────────────────────────────────────────── 저장소 */

/**
 * 신호가 끊겼을 때 보여 줄 것을 앱에 남긴다.
 * 입구에서 신호가 죽어도 예매번호는 보여야 한다.
 */
export async function nativeSet(key: string, value: unknown) {
  const p = plugin("Preferences");
  if (!p) return;
  try {
    await p.set({ key, value: JSON.stringify(value) });
  } catch {
    /* 저장에 실패해도 화면은 그대로 돈다 */
  }
}

/* ─────────────────────────────────────────── 소셜 로그인 */

/** 로그인이 끝나고 앱으로 돌아오는 주소. Info.plist 의 URL 스킴과 같아야 한다 */
export const NATIVE_AUTH_REDIRECT = "io.partymoa.app://auth";

/**
 * 앱에서 소셜 로그인 창을 연다. 끝나면 돌아온 주소를 돌려준다.
 *
 * **웹뷰 안에서 열면 안 된다.** 구글이 임베디드 웹뷰의 OAuth 를
 * 거부한다(disallowed_useragent) — 앱이 로그인 화면의 입력을 들여다볼 수
 * 있어서 막아 둔 정책이다. 사파리를 통째로 여는 것도 답이 아니다.
 * 앱에서 튕겨 나가는 모양이 되고, 세션이 사파리에 남아 앱은 계속
 * 로그아웃 상태다.
 *
 * Browser.open 은 iOS 에서 ASWebAuthenticationSession(시스템이 띄우는
 * 로그인 시트)으로 뜬다. **구글은 이걸 웹뷰로 안 본다.** 앱 위에 덮이듯
 * 열리고, 끝나면 위 스킴으로 앱에 돌아온다.
 *
 * 손님이 그냥 닫으면 아무것도 안 돌아온다 — 그때 null 이다.
 */
export function nativeOAuth(url: string, timeoutMs = 180000): Promise<string | null> {
  const browser = plugin("Browser");
  const app = plugin("App");
  if (!browser || !app) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    let off: (() => void) | null = null;

    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      off?.();
      // 로그인 시트가 열린 채로 남으면 손님이 직접 닫아야 한다
      browser.close().catch(() => {});
      resolve(v);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    (async () => {
      try {
        const h = (await (app as unknown as {
          addListener: (
            e: string,
            cb: (d: { url?: string }) => void,
          ) => Promise<{ remove: () => Promise<void> }>;
        }).addListener("appUrlOpen", (d) => {
          if (d?.url?.startsWith(NATIVE_AUTH_REDIRECT)) finish(d.url);
        }));
        off = () => void h.remove().catch(() => {});
        await browser.open({ url, presentationStyle: "popover" });
      } catch {
        finish(null);
      }
    })();
  });
}
