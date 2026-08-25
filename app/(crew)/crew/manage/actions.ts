"use server";

import { revalidatePath } from "next/cache";

import { myCrew } from "@/lib/crew";
import { createClient } from "@/lib/supabase/server";

export async function updateCrew(input: {
  name: string;
  bio: string;
  instagram: string;
  avatarUrl: string;
}) {
  const crew = await myCrew();
  if (!crew) return { ok: false as const, message: "로그인이 필요해요." };
  if (!input.name.trim()) {
    return { ok: false as const, message: "크루 이름은 비울 수 없어요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("crews")
    .update({
      name: input.name.trim(),
      bio: input.bio.trim() || null,
      // @ 를 떼고 저장한다. 저장할 때 맞춰 두는 게 화면마다 벗기는 것보다 낫다
      instagram: input.instagram.trim().replace(/^@/, "") || null,
      avatar_url: input.avatarUrl.trim() || null,
    })
    .eq("id", crew.id);

  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/crew", "layout");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function addMember(displayName: string, inviteCode: string) {
  const crew = await myCrew();
  if (!crew) return { ok: false as const, message: "로그인이 필요해요." };

  const code = inviteCode.trim().toUpperCase();
  if (!displayName.trim() || !code) {
    return { ok: false as const, message: "이름과 코드를 모두 적어 주세요." };
  }
  if (!/^[A-Z0-9]{2,12}$/.test(code)) {
    return {
      ok: false as const,
      message: "코드는 영문 대문자와 숫자 2~12자로 해 주세요.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("crew_members").insert({
    crew_id: crew.id,
    user_id: null,
    display_name: displayName.trim(),
    invite_code: code,
    role: "member",
  });

  if (error) {
    return {
      ok: false as const,
      message: error.code === "23505" ? "이미 쓰는 코드예요." : error.message,
    };
  }
  revalidatePath("/crew", "layout");
  return { ok: true as const };
}

export async function removeMember(id: string) {
  const supabase = await createClient();
  // 이미 나간 예매의 invite_code 는 문자열로 남아 있어 정산 집계가 깨지지
  // 않는다. 그래서 멤버 행은 지워도 된다
  const { error } = await supabase.from("crew_members").delete().eq("id", id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/crew", "layout");
  return { ok: true as const };
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient();

  // 예매가 하나라도 있으면 지우지 않는다. 손님 티켓이 통째로 사라진다
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");

  if ((count ?? 0) > 0) {
    return {
      ok: false as const,
      message: `예매 ${count}건이 있어 지울 수 없어요. 예매 상태를 '종료'로 바꾸세요.`,
    };
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/crew", "layout");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
