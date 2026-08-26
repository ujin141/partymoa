"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * 프로필 저장.
 *
 * **로그인한 사람만.** 익명 세션에 붙여 두면 브라우저를 지우는 순간
 * 같이 사라진다 — 저장했다고 해 놓고 없어지는 게 제일 나쁘다.
 */
export async function saveProfile(input: {
  nickname: string;
  realName: string;
  phone: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return { ok: false as const, message: "먼저 로그인해 주세요." };
  }

  const nickname = input.nickname.trim();
  const realName = input.realName.trim();
  const phone = input.phone.replace(/[^0-9]/g, "");

  if (nickname.length > 20) {
    return { ok: false as const, message: "닉네임은 20자까지예요." };
  }
  if (phone && phone.length < 10) {
    return { ok: false as const, message: "연락처를 확인해 주세요." };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      nickname: nickname || null,
      real_name: realName || null,
      // 010-1234-5678 로 통일한다. 현장에서 눌러 걸 수 있어야 한다
      phone: phone
        ? phone.length === 11
          ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`
          : phone
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/my", "layout");
  return { ok: true as const };
}
