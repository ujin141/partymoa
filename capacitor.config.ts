import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS 껍데기.
 *
 * **웹을 앱에 넣지 않는다.** 이 앱은 페이지 34개가 force-dynamic 이고
 * 서버 컴포넌트 48곳에서 Supabase 를 부른다. 정적으로 뽑을 수가 없어서
 * 배포된 주소를 그대로 띄운다.
 *
 * **그래서 이것만으로는 심사에 떨어진다.** 웹뷰에 주소만 물린 앱은
 * 가이드라인 4.2 로 반려된다. 네이티브 푸시 · 오프라인 티켓 · QR 스캔을
 * 붙여야 앱일 이유가 생긴다. webDir 은 그 오프라인 화면이 들어갈 자리다.
 */
const config: CapacitorConfig = {
  appId: "com.partymoa.app",
  appName: "파티모아",
  webDir: "ios-shell",
  server: {
    url: "https://www.partymoa.com",
    // 우리 도메인 밖으로 나가면 웹뷰가 아니라 사파리로 연다.
    // 앱 안에서 남의 사이트가 열리면 그것도 4.2 로 잡힌다
    allowNavigation: ["www.partymoa.com"],
  },
  ios: {
    // 흰 배경으로 두면 로딩 순간에 흰 판이 번쩍인다
    backgroundColor: "#FFFFFF",
    /**
     * **웹뷰를 밀어 넣지 않는다.**
     *
     * 화면은 이미 안전영역을 직접 처리한다 — layout 이 pt-[env(safe-area-inset-top)],
     * 탭바가 pb-[env(safe-area-inset-bottom)] 를 쓰고 viewport 는 fit=cover 다.
     * 여기서 always 로 두면 웹뷰가 한 번 밀리고 화면이 또 밀어서 위아래가
     * 두 번씩 들어간다. never 로 둬야 env() 가 진짜 값을 받는다.
     */
    contentInset: "never",
  },
};

export default config;
