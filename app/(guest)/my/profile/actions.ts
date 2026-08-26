"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// 시작 화면·프로필이 같은 목록을 써야 고른 값이 필터에 걸린다
const AREAS = ["강남", "홍대", "이태원", "성수", "양재", "잠실"];
const CATEGORIES = [
  "풀파티",
  "솔로파티",
  "루프탑",
  "클럽",
  "라운지",
  "야외",
  "테크노",
  "하우스",
  "힙합",
];

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
  areas: string[];
  categories: string[];
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
      // **아는 값만 넣는다.** 클라이언트가 보낸 문자열을 그대로 넣으면
      // 필터에 영영 안 걸리는 값이 쌓인다
      areas: input.areas.filter((a) => AREAS.includes(a)),
      categories: input.categories.filter((c) => CATEGORIES.includes(c)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/my", "layout");
  return { ok: true as const };
}
