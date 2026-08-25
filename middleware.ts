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
export async function middleware(req: NextRequest) {
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
