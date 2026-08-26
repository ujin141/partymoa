"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ApplyInput = {
  crewName: string;
  slug: string;
  instagram: string;
  bio: string;
  contactName: string;
  contactPhone: string;
  email: string;
  venue: string;
  scale: string;
  history: string;
  note: string;
};

/**
 * 호스트 신청.
 *
 * **로그인한 계정에 묶어서 받는다.** 익명 세션으로 받으면 승인해도 그
 * 계정에 권한을 이어 줄 수가 없고, 같은 사람이 몇 번을 냈는지도 모른다.
 *
 * 검사는 서버에서 다시 한다 — 폼의 disabled 는 사용자가 지울 수 있다.
 */
export async function applyForCrew(input: ApplyInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    return { ok: false as const, message: "먼저 로그인해 주세요." };
  }

  const crewName = input.crewName.trim();
  const slug = input.slug.trim().toLowerCase();
  const contactName = input.contactName.trim();
  const phone = input.contactPhone.replace(/[^0-9]/g, "");
  const email = input.email.trim().toLowerCase();

  if (crewName.length < 2) {
    return { ok: false as const, message: "호스트 이름을 적어 주세요." };
  }
  if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
    return {
      ok: false as const,
      message: "주소는 영문 소문자·숫자·하이픈 2~32자로 적어 주세요.",
    };
  }
  if (!contactName) {
    return { ok: false as const, message: "담당자 이름을 적어 주세요." };
  }
  if (phone.length < 10) {
    return { ok: false as const, message: "연락처를 확인해 주세요." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false as const, message: "이메일을 확인해 주세요." };
  }

  // 이미 쓰는 주소면 승인 때 어차피 막힌다. 신청 단계에서 알려 준다
  const { data: taken } = await supabase
    .from("crews")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (taken) {
    return { ok: false as const, message: "이미 쓰는 주소예요. 다른 걸로 해 주세요." };
  }

  // 심사 중인 신청이 또 들어오면 운영자가 같은 걸 두 번 본다
  const { data: pending } = await supabase
    .from("crew_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return {
      ok: false as const,
      message: "이미 넣은 신청이 심사 중이에요. 결과를 기다려 주세요.",
    };
  }

  const { error } = await supabase.from("crew_applications").insert({
    crew_name: crewName,
    slug,
    instagram: input.instagram.trim().replace(/^@/, "") || null,
    bio: input.bio.trim() || null,
    contact_name: contactName,
    contact_phone: phone,
    email,
    venue: input.venue.trim() || null,
    scale: input.scale.trim() || null,
    history: input.history.trim() || null,
    note: input.note.trim() || null,
    user_id: user.id,
  });
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/my/crew-apply");
  revalidatePath("/admin/applications");
  return { ok: true as const };
}
