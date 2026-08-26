"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

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
 * 취향 저장.
 *
 * **아는 값만 받는다.** 클라이언트가 보낸 문자열을 그대로 넣으면 필터가
 * 영영 안 맞는 값이 쌓이고, 나중에 목록을 바꿀 때 뭐가 남아 있는지
 * 알 수 없게 된다.
 *
 * 로그인 안 한 사람은 브라우저에만 남긴다 — 익명 세션 프로필은 브라우저를
 * 지우는 순간 같이 사라진다.
 */
export async function savePreferences(input: {
  areas: string[];
  categories: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { ok: false as const };

  const areas = input.areas.filter((a) => AREAS.includes(a));
  const categories = input.categories.filter((c) => CATEGORIES.includes(c));

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      areas,
      categories,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * 로그인 전에 쿠키에 담아 둔 취향을 프로필로 옮긴다.
 *
 * 로그인 직후 한 번 부른다. **이미 프로필에 취향이 있으면 덮지 않는다** —
 * 오래된 쿠키가 나중에 고친 값을 되돌리면 안 된다.
 */
export async function adoptCookiePreferences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { ok: false as const };

  const raw = (await cookies()).get("pm_prefs")?.value;
  if (!raw) return { ok: false as const };

  const { data: existing } = await supabase
    .from("profiles")
    .select("areas, categories")
    .eq("user_id", user.id)
    .maybeSingle();
  const cur = existing as { areas: string[]; categories: string[] } | null;
  if (cur && (cur.areas.length || cur.categories.length)) {
    return { ok: false as const };
  }

  try {
    const v = JSON.parse(decodeURIComponent(raw)) as {
      areas?: string[];
      categories?: string[];
    };
    await savePreferences({
      areas: Array.isArray(v.areas) ? v.areas : [],
      categories: Array.isArray(v.categories) ? v.categories : [],
    });
  } catch {
    return { ok: false as const };
  }
  return { ok: true as const };
}
