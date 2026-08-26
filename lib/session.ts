import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * 이번 요청의 사용자. **한 번만 묻는다.**
 *
 * getUser() 는 Supabase 인증 서버까지 왕복한다. 화면 하나를 그리는 데
 * 레이아웃·페이지·쿼리가 각자 부르면 그만큼 왕복이 붙는다 — 홈 한 번에
 * 서너 번씩 났다. React 의 cache 로 요청 안에서 한 번으로 접는다.
 *
 * **세션 쿠키가 없으면 아예 안 묻는다.** 로그인 안 한 방문자에게 인증
 * 왕복을 붙이지 않는다. 그쪽이 대부분이다.
 */
export const currentUser = cache(async () => {
  const jar = await cookies();
  const has = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!has) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** 진짜 로그인한 사람인가. 익명 세션은 아니다 */
export async function isSignedIn() {
  const u = await currentUser();
  return Boolean(u && !u.is_anonymous);
}
