"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 크루 온보딩.
 *
 * **계정 생성은 여기서 안 한다.** 서비스 롤 키가 있어야 auth 사용자를 만들 수
 * 있고, 그 키를 이 앱에 들여놓으면 사고 반경이 커진다.
 *
 * 그렇다고 "대표가 먼저 가입해야 등록된다" 로 두면 순서가 거꾸로다. 크루를
 * 섭외하는 쪽은 등록해 놓고 링크를 보내는 게 자연스럽다 — 실제로 이것 때문에
 * 온보딩이 막혔다.
 *
 * 그래서 이메일만 받는다. 이미 가입한 계정이면 대표로 묶고, 아직이면
 * `crew_members.email` 에 적어 둔다. 그 주소로 처음 로그인하는 순간
 * is_crew_staff() 가 통과시킨다.
 */
export async function createCrew(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  bio: string;
  instagram: string;
  avatarUrl?: string;
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

  const email = input.ownerEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false as const, message: "대표 이메일을 확인해 주세요." };
  }

  // 있으면 계정을 묶고, 없으면 이메일만 적어 둔다. 없다고 막지 않는다
  const { data: owner } = await supabase.rpc("find_user_id", {
    p_email: email,
  });

  const { data: crew, error } = await supabase
    .from("crews")
    .insert({
      name: input.name.trim(),
      slug,
      bio: input.bio.trim() || null,
      instagram: input.instagram.trim().replace(/^@/, "") || null,
      avatar_url: input.avatarUrl?.trim() || null,
      owner_id: (owner as string | null) ?? null,
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

  // 대표에게 초대 코드를 하나 준다. 없으면 정산 집계가 시작을 못 한다.
  // **이메일을 꼭 같이 적는다** — 계정이 아직 없을 때 이게 유일한 열쇠다
  const { error: memberErr } = await supabase.from("crew_members").insert({
    crew_id: crew.id,
    user_id: (owner as string | null) ?? null,
    email,
    display_name: input.name.trim(),
    invite_code: slug.replace(/-/g, "").slice(0, 12).toUpperCase(),
    role: "owner",
  });
  if (memberErr) {
    // 크루만 만들어지고 아무도 못 들어가는 상태로 두지 않는다
    await supabase.from("crews").delete().eq("id", crew.id);
    return { ok: false as const, message: memberErr.message };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return {
    ok: true as const,
    pending: !owner,
    message: owner
      ? `${input.name.trim()} 등록했어요. 대표가 바로 크루 화면에 들어갑니다.`
      : `${input.name.trim()} 등록했어요. ${email} 로 구글 로그인하면 크루 화면이 열립니다.`,
  };
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
