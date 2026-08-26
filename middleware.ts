import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * www 로 모은다.
 *
 * **소셜 로그인이 도메인마다 갈린다.** PKCE 검증값은 로그인을 시작한
 * 도메인의 쿠키에 저장된다. partymoa.com 에서 눌렀는데 Supabase 가
 * Site URL(www.partymoa.com)로 돌려보내면 검증값이 없는 쪽에 도착해서
 * 코드 교환이 깨진다 — 화면에는 그냥 "로그인이 안 된다" 로만 보인다.
 *
 * Supabase 의 Site URL·Redirect URLs 가 www 로 잡혀 있으니 앱도 www 로
 * 맞춘다. 로컬(localhost)과 프리뷰 배포는 건드리지 않는다.
 */
function canonicalHost(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (host !== "partymoa.com") return null;
  const to = new URL(req.url);
  to.host = "www.partymoa.com";
  to.protocol = "https:";
  to.port = "";
  return to;
}

/**
 * 모든 응답에 붙는 보안 헤더.
 *
 * CSP 는 안 건다 — Next 가 인라인 스크립트로 하이드레이션 데이터를
 * 넘기고, nonce 를 붙이려면 모든 페이지를 동적으로 돌려야 한다.
 * 그러면 캐시가 통째로 죽어서 얻는 것보다 잃는 게 크다. 대신 나머지를
 * 촘촘히 건다.
 */
function harden(res: NextResponse) {
  res.headers.set("x-content-type-options", "nosniff");
  // 우리 화면을 남의 사이트에 끼워 넣지 못하게 — 클릭재킹
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  // 쓰지 않는 기기 권한은 아예 닫는다
  res.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  // 한 번 https 로 왔으면 다음부터 물어보지 않는다
  res.headers.set(
    "strict-transport-security",
    "max-age=63072000; includeSubDomains; preload",
  );
  return res;
}

/**
 * 세션 쿠키를 갱신한다. 이게 없으면 서버 컴포넌트가 만료된 토큰을 들고
 * 로그인 안 된 것처럼 굴어서 크루가 계속 로그인 화면으로 튕긴다.
 *
 * **세션 쿠키가 없으면 아예 부르지 않는다.** 예전에는 요청마다 Supabase
 * 를 한 번씩 불렀다 — 로그인 안 한 사람이 홈을 보는 것만으로도 왕복이
 * 한 번씩 생겼고, 그게 지연과 비용의 제일 큰 덩어리였다. 갱신할 세션이
 * 없으면 갱신할 것도 없다.
 *
 * **여기서 절대 던지지 않는다.** 미들웨어가 죽으면 Vercel 이
 * MIDDLEWARE_INVOCATION_FAILED 로 **모든 요청을 500** 으로 만든다.
 */
export async function middleware(req: NextRequest) {
  const canonical = canonicalHost(req);
  if (canonical) return NextResponse.redirect(canonical, 308);

  /**
   * **로그인 코드가 엉뚱한 자리로 떨어지면 주워서 콜백에 넘긴다.**
   *
   * Supabase 의 Redirect URLs 에 우리 콜백 주소가 없으면, 구글에서
   * 돌아오는 요청을 Site URL(첫 화면)로 보내 버린다. 그러면 `?code=`
   * 가 아무도 안 읽는 자리에 떨어지고 — 오류도 없이 그냥 로그인이
   * 안 된 것처럼 보인다. 설정이 어긋나도 로그인은 되게 한다.
   */
  const here = new URL(req.url);
  if (
    here.searchParams.has("code") &&
    !here.pathname.startsWith("/auth/callback")
  ) {
    const to = new URL("/auth/callback", here.origin);
    here.searchParams.forEach((v, k) => to.searchParams.set(k, v));
    if (!to.searchParams.has("next")) {
      to.searchParams.set("next", here.pathname === "/" ? "/my" : here.pathname);
    }
    return NextResponse.redirect(to);
  }

  const res = harden(NextResponse.next({ request: req }));

  // 세션 쿠키가 없으면 갱신할 것도 없다. 로그인 안 한 방문자에게
  // Supabase 왕복을 한 번씩 붙이지 않는다
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasSession) return res;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      "[middleware] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 없습니다. " +
        "세션 갱신을 건너뜁니다 — 배포 환경변수를 확인하세요.",
    );
    return res;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    });
    await supabase.auth.getUser();
  } catch (e) {
    // 네트워크가 잠깐 끊겨도 사이트는 열려 있어야 한다
    console.error("[middleware] 세션 갱신 실패", e);
  }

  return res;
}

export const config = {
  matcher: [
    /**
     * 정적 파일은 건너뛴다. **여기 빠뜨리면 이미지 한 장마다 미들웨어가
     * 한 번씩 돈다** — 사진 다섯 장짜리 파티 화면이면 요청이 그만큼 는다.
     */
    "/((?!_next/static|_next/image|favicon.ico|fonts|covers|photos|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|ttf)$).*)",
  ],
};
