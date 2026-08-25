"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const SAY: Record<string, string> = {
  BAD_NICKNAME: "닉네임은 1~20자로 적어 주세요.",
  BAD_BODY: "내용을 확인해 주세요.",
  DUPLICATE: "방금 올린 글과 같아요.",
  POST_NOT_FOUND: "지워진 글이에요.",
  NO_SESSION: "이 기기에서 쓴 글만 지울 수 있어요.",
  NOT_YOURS: "이 기기에서 쓴 글만 지울 수 있어요.",
};

const say = (msg: string | undefined) =>
  SAY[(msg ?? "").trim()] ?? "잠시 뒤 다시 시도해 주세요.";

export async function writePost(
  nickname: string,
  body: string,
  eventId: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_post", {
    p_nickname: nickname,
    p_body: body,
    p_event_id: eventId,
  });
  if (error) return { ok: false as const, message: say(error.message) };
  revalidatePath("/community");
  return { ok: true as const, id: data.id };
}

export async function writeComment(
  postId: string,
  nickname: string,
  body: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_comment", {
    p_post_id: postId,
    p_nickname: nickname,
    p_body: body,
  });
  if (error) return { ok: false as const, message: say(error.message) };
  revalidatePath(`/community/${postId}`);
  revalidatePath("/community");
  return { ok: true as const };
}

export async function removePost(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_post", { p_id: id });
  if (error) return { ok: false as const, message: say(error.message) };
  revalidatePath("/community");
  return { ok: true as const };
}

export async function removeComment(id: string, postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_comment", { p_id: id });
  if (error) return { ok: false as const, message: say(error.message) };
  revalidatePath(`/community/${postId}`);
  return { ok: true as const };
}
