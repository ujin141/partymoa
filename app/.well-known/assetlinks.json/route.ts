import { NextResponse } from "next/server";

/**
 * 안드로이드 앱과 이 도메인을 잇는다.
 *
 * **이게 없으면 앱 안에 주소창이 뜬다.** TWA 는 크롬을 껍데기 없이
 * 띄우는 것인데, 크롬은 이 파일을 읽어서 "이 앱이 정말 이 사이트의
 * 앱인가" 를 확인한다. 확인이 안 되면 일반 탭처럼 주소창을 붙여서
 * 보여 준다 — 손님 눈에는 그냥 브라우저다.
 *
 * 지문은 **서명 인증서마다 다르다.** 그래서 여러 개를 적는다.
 *
 *  1. 디버그 키 — 우리 컴퓨터에서 만든 테스트 빌드
 *  2. 업로드 키 — 우진이 만든 키. Play 에 올릴 때 서명하는 것
 *  3. Play 앱 서명 키 — **Play 가 다시 서명한다.** 손님 폰에 깔리는
 *     건 이 서명이라, 이게 없으면 스토어에서 받은 앱만 주소창이 뜬다.
 *     Play 콘솔 → 설정 → 앱 서명 에서 SHA-256 을 복사해 넣는다.
 *
 * 파일로 두지 않고 라우트로 만든 이유는, public/ 의 점으로 시작하는
 * 폴더가 배포에서 빠지는 경우가 있어서다. 여기 두면 확실하다.
 */

const PACKAGE = "com.partymoa.app";

const FINGERPRINTS = [
  // 디버그 — 이 컴퓨터의 ~/.android/debug.keystore
  "CD:C6:CE:43:D9:B4:A1:40:D0:7D:36:56:B8:80:A1:6B:D6:CE:FD:65:60:27:1F:DA:B1:13:45:90:D5:53:7E:DA",
  // ⬛ 업로드 키 — android/android.keystore 를 만들면 그 지문을 넣는다
  // ⬛ Play 앱 서명 키 — 콘솔 → 설정 → 앱 서명 에서 복사
];

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE,
          sha256_cert_fingerprints: FINGERPRINTS,
        },
      },
    ],
    { headers: { "content-type": "application/json" } },
  );
}
