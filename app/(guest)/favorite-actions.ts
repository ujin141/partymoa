"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * 찜 토글.
 *
 * 세션이 없으면 찜할 곳이 없다 — 로그인으로 보내라고 알려 준다.
 * 익명 세션도 세션이라 찜은 된다. 로그인하면 계정을 이어받으므로
 * 그때 찜도 같이 따라온다(linkIdentity 를 쓰는 이유 중 하나다).
 */
export async function toggleFavorite(eventId: string, on: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, needLogin: true as const };

  const { error } = on
    ? await supabase
        .from("favorites")
        .upsert({ user_id: user.id, event_id: eventId })
    : await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);

  if (error) return { ok: false as const, needLogin: false as const };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
