"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * 로그아웃. 크루가 남의 폰이나 공용 태블릿으로 입장 확인을 하고 나면
 * 반드시 끊을 수 있어야 한다 — 명단에 손님 연락처가 다 들어 있다.
 *
 * 게스트의 익명 세션도 같은 함수로 끊는다. 끊으면 EnsureSession 이 다음
 * 방문에 새 익명 세션을 만들고, 그 순간 이전 티켓과의 연결은 사라진다.
 * 그래서 게스트 화면에서는 그 점을 먼저 알린다.
 */
export async function signOut(to = "/") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(to);
}
