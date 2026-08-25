import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** 매직 링크가 돌아오는 자리. 코드를 세션으로 바꾸고 원래 가려던 곳으로 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/crew";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/crew/login?error=1", url.origin));
}
