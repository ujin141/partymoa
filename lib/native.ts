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
