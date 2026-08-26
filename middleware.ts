import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 세션 쿠키를 갱신한다. 이게 없으면 서버 컴포넌트가 만료된 토큰을 들고
 * 로그인 안 된 것처럼 굴어서 크루가 계속 로그인 화면으로 튕긴다.
 *
 * **여기서 절대 던지지 않는다.** 미들웨어가 죽으면 Vercel 이
 * MIDDLEWARE_INVOCATION_FAILED 로 **모든 요청을 500** 으로 만든다.
 * 환경변수 하나 빠진 걸로 사이트 전체가 안 열리는 건 과하다 —
 * 세션 갱신을 건너뛰고 페이지는 그대로 내보낸다.
 */
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

export async function middleware(req: NextRequest) {
  const canonical = canonicalHost(req);
  if (canonical) return NextResponse.redirect(canonical, 308);

  const res = NextResponse.next({ request: req });

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
    // 정적 파일과 이미지는 건너뛴다
    "/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
