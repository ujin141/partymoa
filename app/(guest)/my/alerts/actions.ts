"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * 광고성 푸시 수신 동의.
 *
 * **동의한 시각을 남긴다.** 나중에 "동의한 적 없다" 는 말이 나오면
 * 그게 유일한 근거다. 껐을 때는 시각을 지우지 않는다 — 언제 동의했고
 * 언제 껐는지가 둘 다 남아야 한다.
 */
export async function setMarketingPush(on: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "세션이 없어요." };

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      marketing_push: on,
      // 켤 때만 시각을 새로 찍는다
      ...(on ? { marketing_push_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/my/alerts");
  return { ok: true as const };
}
