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
  /**
   * 애플에 등록이 안 됐다. 서명이 없거나 시뮬레이터거나 망이 끊겼다.
   * detail 은 iOS 가 준 오류 문장 — 시간이 다 된 경우엔 없다
   */
  | { error: "register"; detail?: string }
  /** 플러그인이 앱에 안 들어갔다. 빌드 문제다 */
  | { error: "plugin" };

/**
 * 이번 실행에서 마지막으로 받은 디바이스 토큰.
 *
 * **iOS 는 토큰을 한 번 주고 나면 다시 잘 안 준다.** 같은 실행 안에서
 * register() 를 또 불러도 델리게이트가 안 올 때가 있다 — 특히
 * unregister 를 거친 뒤가 그렇다. 실기기에서 알림을 껐다 다시 켜니
 * 30초를 기다리다 "연결하지 못했어요" 로 끝났다(추정 원인. 로그에는
 * DELETE 뒤에 POST 가 안 온 것만 남아 있다).
 *
 * 그래서 한 번 받은 토큰은 여기 들고 있다가, 권한이 있으면 애플을
 * 기다리지 않고 바로 쓴다. 토큰이 바뀌면 등록 이벤트가 또 와서 갱신된다.
 */
let lastToken: string | null = null;

export function nativePushToken(timeoutMs = 30000): Promise<PushResult> {
  const p = plugin("PushNotifications");
  if (!p) return Promise.resolve({ error: "plugin" });

  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (v: PushResult) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(v);
    };

    (async () => {
      try {
        const perm = (await p.requestPermissions()) as { receive?: string };
        if (perm?.receive !== "granted") return finish({ error: "denied" });

        // 이미 받아 둔 토큰이 있으면 애플을 기다릴 이유가 없다
        if (lastToken) return finish({ token: lastToken });

        /**
         * **시계는 여기서 시작한다.**
         *
         * 전에는 requestPermissions 앞에서 쟀다. 그 15초 안에 시스템
         * 창이 뜨고, 손님이 읽고, 허용을 누르는 시간까지 다 들어갔다.
         * 누르는 데 10초 걸리면 애플에 등록할 시간이 5초밖에 안 남는다 —
         * 셀룰러에서 그 시간에 못 끝나면 "연결하지 못했어요" 가 뜬다.
         * 실제로 실기기에서 그렇게 났다.
         *
         * 사람이 기다리는 시간은 재지 않는다. 재는 건 애플과의 왕복뿐이다.
         */
        timer = setTimeout(() => finish({ error: "register" }), timeoutMs);

        // **등록보다 먼저 붙인다.** register 가 먼저 가면 그 응답을
        // 받을 사람이 없다
        await (p as unknown as {
          addListener: (
            e: string,
            cb: (d: { value?: string; error?: string }) => void,
          ) => Promise<unknown>;
        }).addListener("registration", (d) => {
          if (d?.value) lastToken = d.value;
          finish(d?.value ? { token: d.value } : { error: "register" });
        });
        await (p as unknown as {
          addListener: (e: string, cb: (d: { error?: string }) => void) => Promise<unknown>;
        }).addListener("registrationError", (d) => {
          // 문장을 버리지 않는다. 화면에 보여야 다음 제보에서 원인이 보인다
          finish({ error: "register", detail: d?.error });
        });
        await p.register();
      } catch {
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

/*
 * 끄기는 서버 행을 지우는 것으로 끝난다. **애플 쪽 등록(unregister)은
 * 건드리지 않는다.** 예전엔 여기서 unregisterForRemoteNotifications 를
 * 불렀는데, 그 뒤 같은 실행에서 다시 켜면 애플이 토큰을 안 돌려줘
 * 켜지지 않았다(추정. 애플 문서도 이 호출은 "드문 경우에만" 쓰라고
 * 한다). 토큰은 그대로 유효하니 다시 켤 때 서버 행만 되살리면 된다.
 */

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

/* ─────────────────────────────────────────── 알림을 눌렀을 때 */

/**
 * 손님이 알림을 눌렀을 때 어디로 갈지 알려 준다.
 *
 * **이게 없으면 눌러도 아무 일이 안 일어난다.** 웹은 sw.js 의
 * notificationclick 이 그 일을 하는데, 앱에는 그 짝이 없었다. 서버가
 * url 을 담아 보내도 앱이 읽는 곳이 없어서 그냥 버려졌다.
 *
 * **앱이 꺼져 있다 열리는 경우도 이 리스너가 받는다.** Capacitor 가
 * 플러그인 준비가 끝난 뒤에 쌓아 둔 것을 흘려 준다.
 *
 * 돌려주는 함수를 부르면 리스너를 뗀다.
 */
export function onPushOpened(cb: (path: string) => void): () => void {
  const p = plugin("PushNotifications");
  if (!p) return () => {};

  let handle: { remove: () => Promise<void> } | null = null;
  let off = false;

  (async () => {
    try {
      const h = await (p as unknown as {
        addListener: (
          e: string,
          cb: (d: { notification?: { data?: Record<string, unknown> } }) => void,
        ) => Promise<{ remove: () => Promise<void> }>;
      }).addListener("pushNotificationActionPerformed", (d) => {
        const raw = d?.notification?.data?.url;
        if (typeof raw !== "string") return;
        /**
         * **우리 앱 안의 경로만 받는다.** `//evil.com` 같은 스킴 없는
         * 절대 주소는 브라우저가 남의 사이트로 읽는다. 알림은 우리가
         * 보내지만, 값을 그대로 믿고 넘기는 자리를 만들지 않는다.
         */
        if (!raw.startsWith("/") || raw.startsWith("//")) return;
        cb(raw);
      });
      if (off) await h.remove().catch(() => {});
      else handle = h;
    } catch {
      /* 플러그인이 없으면 그만이다 */
    }
  })();

  return () => {
    off = true;
    void handle?.remove().catch(() => {});
  };
}

/* ─────────────────────────────────────────── 스플래시 */

/**
 * 스플래시를 내린다. **웹이 그려진 다음에 부른다.**
 *
 * 설정(capacitor.config.ts)에도 자동으로 내리는 시간이 걸려 있지만,
 * 그건 "끝내 안 열릴 때" 를 위한 보험이다. 망이 빠르면 웹은 그보다
 * 훨씬 일찍 준비되는데, 그때까지 로고를 붙들고 있으면 앱이 느려 보인다.
 *
 * 둘 중 먼저 오는 쪽이 이긴다. 여기서 실패해도 자동으로 내려간다.
 */
export async function nativeHideSplash() {
  const p = plugin("SplashScreen");
  try {
    await p?.hide({ fadeOutDuration: 200 });
  } catch {
    /* 설정에 걸어 둔 시간이 알아서 내린다 */
  }
}
