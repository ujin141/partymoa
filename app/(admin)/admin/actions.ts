"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 크루 온보딩.
 *
 * **계정 생성은 여기서 안 한다.** 서비스 롤 키가 있어야 auth 사용자를 만들 수
 * 있고, 그 키를 이 앱에 들여놓으면 사고 반경이 커진다. 대신 이미 가입한
 * 사람의 이메일을 받아 그 계정을 크루 대표로 묶는다.
 * (가입은 그 사람이 /crew/login 에서 한 번 하면 된다.)
 */
export async function createCrew(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  bio: string;
  instagram: string;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const slug = input.slug.trim().toLowerCase();
  if (!input.name.trim() || !/^[a-z0-9-]{2,32}$/.test(slug)) {
    return {
      ok: false as const,
      message: "이름과 slug(영문 소문자·숫자·하이픈 2~32자)를 확인해 주세요.",
    };
  }

  const { data: owner, error: findErr } = await supabase.rpc("find_user_id", {
    p_email: input.ownerEmail.trim(),
  });
  if (findErr || !owner) {
    return {
      ok: false as const,
      message:
        "그 이메일로 가입한 계정이 없어요. 대표가 먼저 /crew/login 에서 로그인해야 합니다.",
    };
  }

  const { data: crew, error } = await supabase
    .from("crews")
    .insert({
      name: input.name.trim(),
      slug,
      bio: input.bio.trim() || null,
      instagram: input.instagram.trim().replace(/^@/, "") || null,
      owner_id: owner as string,
    })
    .select()
    .single();

  if (error) {
    return {
      ok: false as const,
      message:
        error.code === "23505" ? "이미 쓰는 slug 예요." : error.message,
    };
  }

  // 대표에게 초대 코드를 하나 준다. 없으면 정산 집계가 시작을 못 한다
  await supabase.from("crew_members").insert({
    crew_id: crew.id,
    user_id: owner as string,
    display_name: input.name.trim(),
    invite_code: slug.replace(/-/g, "").slice(0, 12).toUpperCase(),
    role: "owner",
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function hidePost(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/admin/community");
  revalidatePath("/community");
  return { ok: true as const };
}

export async function hideComment(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/admin/community");
  return { ok: true as const };
}
