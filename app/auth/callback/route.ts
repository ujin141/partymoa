import { NextResponse } from "next/server";

import { adoptCookiePreferences } from "@/app/(guest)/onboarding/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * 소셜 로그인이 돌아오는 자리.
 *
 * **실패하면 이유를 그대로 들고 간다.** 예전에는 무조건 크루 로그인으로
 * `?error=1` 만 붙여 던졌다. 손님이 게스트 로그인을 눌렀는데 크루 로그인
 * 화면이 뜨니 "로그인이 안 된다" 로만 보이고, 왜 안 되는지는 아무 데도
 * 안 남았다.
 *
 * 실패는 대개 셋 중 하나다.
 *  - 제공자를 아직 안 켰다 (provider is not enabled)
 *  - 주소가 www 가 붙었다 안 붙었다 한다. PKCE 검증 쿠키는 도메인마다
 *    따로라, 시작한 도메인과 돌아온 도메인이 다르면 코드 교환이 깨진다
 *  - Redirect URLs 에 그 주소가 없어서 Supabase 가 Site URL 로 되돌린다
 */

/** 어디로 가려던 길이었나에 따라 돌려보낼 로그인 문을 고른다 */
function loginDoor(next: string) {
  if (next.startsWith("/admin")) return "/admin/login";
  if (next.startsWith("/crew")) return "/crew/login";
  return "/login";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/my";

  const fail = (message: string) => {
    const to = new URL(loginDoor(next), url.origin);
    to.searchParams.set("error", message);
    if (next) to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  };

  // 제공자가 거절한 경우. code 없이 error 만 달고 돌아온다
  const oauthError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (oauthError) return fail(oauthError);

  if (!code) {
    return fail(
      "로그인 코드가 오지 않았어요. 주소가 www 로 시작하는지 확인해 주세요.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  // 로그인 전에 시작 화면에서 고른 취향을 계정으로 옮긴다. 실패해도
  // 로그인은 그대로 진행한다 — 취향 때문에 로그인이 막히면 안 된다
  await adoptCookiePreferences().catch(() => null);

  return NextResponse.redirect(new URL(next, url.origin));
}
