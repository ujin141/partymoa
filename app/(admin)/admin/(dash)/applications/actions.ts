"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { CrewApplication } from "@/types/database";

/**
 * 크루 신청 승인 — 신청서를 그대로 크루로 만든다.
 *
 * **신청자가 아직 가입 전이어도 승인된다.** 계정이 있으면 대표로 묶고,
 * 없으면 `crew_members.email` 에 적어 둔다. 그 주소로 처음 로그인하는
 * 순간 is_crew_staff() 가 통과시킨다.
 *
 * 크루만 만들어지고 아무도 못 들어가는 상태는 만들지 않는다 — 멤버 줄이
 * 안 들어가면 크루를 도로 지운다.
 */
export async function approveApplication(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("crew_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const app = row as CrewApplication | null;
  if (!app) return { ok: false as const, message: "없는 신청이에요." };
  if (app.status !== "pending") {
    return { ok: false as const, message: "이미 처리한 신청이에요." };
  }

  const email = app.email.trim().toLowerCase();
  const { data: owner } = await supabase.rpc("find_user_id", { p_email: email });

  const { data: crew, error } = await supabase
    .from("crews")
    .insert({
      name: app.crew_name,
      slug: app.slug,
      bio: app.bio,
      instagram: app.instagram,
      owner_id: (owner as string | null) ?? null,
    })
    .select()
    .single();
  if (error) {
    return {
      ok: false as const,
      message: error.code === "23505" ? "이미 쓰는 주소예요." : error.message,
    };
  }

  // 대표에게 초대 코드를 하나 준다. 없으면 멤버별 집계가 시작을 못 한다
  const { error: memberErr } = await supabase.from("crew_members").insert({
    crew_id: crew.id,
    user_id: (owner as string | null) ?? null,
    email,
    display_name: app.contact_name,
    invite_code: app.slug.replace(/-/g, "").slice(0, 12).toUpperCase(),
    role: "owner",
  });
  if (memberErr) {
    await supabase.from("crews").delete().eq("id", crew.id);
    return { ok: false as const, message: memberErr.message };
  }

  await supabase
    .from("crew_applications")
    .update({
      status: "approved",
      crew_id: crew.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return {
    ok: true as const,
    message: owner
      ? `${app.crew_name} 승인. 대표가 바로 크루 화면에 들어갑니다.`
      : `${app.crew_name} 승인. ${email} 로 로그인하면 크루 화면이 열립니다.`,
  };
}

/**
 * 반려. **사유를 반드시 적는다.** 신청자 화면에 그대로 보이고, 고쳐서
 * 다시 낼 수 있어야 한다. 사유 없이 막으면 같은 신청이 또 들어온다.
 */
export async function rejectApplication(id: string, reason: string) {
  await requireAdmin();
  const text = reason.trim();
  if (text.length < 2) {
    return { ok: false as const, message: "반려 사유를 적어 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("crew_applications")
    .update({
      status: "rejected",
      reject_reason: text,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/admin/applications");
  return { ok: true as const, message: "반려했어요." };
}
