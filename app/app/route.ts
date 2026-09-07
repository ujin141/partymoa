import { NextResponse } from "next/server";

import { APP_STORE_URL } from "@/lib/store";

/**
 * `partymoa.com/app` → 앱 받는 곳.
 *
 * **QR 이 이 주소를 담는다.** /api/qr 은 우리 도메인 경로만 받는다 —
 * 아무 문자열이나 넣게 두면 남이 우리 서버로 피싱 링크 QR 을 찍어 간다.
 * 그래서 스토어 주소를 직접 QR 에 넣을 수 없고, 우리 쪽 짧은 주소를
 * 하나 두고 여기서 넘긴다.
 *
 * 덤으로 **사람이 읽고 칠 수 있는 주소**가 생긴다. PC 안내창에 이걸
 * 적어 두면 QR 을 못 찍는 사람도 폰에 그냥 쳐 넣을 수 있다.
 *
 * 아이폰이 아니면 스토어로 보내도 받을 게 없다. 안드로이드·PC 는 홈으로
 * 돌려보내고, 거기서 각자 길을 안내한다(크롬 앱 설치 · PC 안내창).
 */
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const ios = /iPhone|iPad|iPod/i.test(ua);
  return NextResponse.redirect(ios ? APP_STORE_URL : new URL("/", req.url), {
    // 영구 리디렉트로 두면 브라우저가 기억해서, 나중에 안드로이드 스토어에
    // 올렸을 때 그 사람만 계속 옛 목적지로 간다
    status: 302,
  });
}
