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
  NO_SESSION_REPORT: "잠시 뒤 다시 시도해 주세요.",
  BAD_REASON: "어떤 점이 문제인지 한 줄만 적어 주세요.",
  SELF: "내 글은 차단할 수 없어요.",
  NOT_FOUND: "이미 지워진 글이에요.",
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

/**
 * 신고. **글은 그대로 두고 운영자에게만 알린다.**
 *
 * 신고했다고 바로 지우면 그게 곧 남의 글을 지우는 버튼이 된다.
 * 지금 당장 안 보고 싶은 사람에게는 차단이 있다.
 */
export async function reportContent(
  type: "post" | "comment",
  id: string,
  reason: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_content", {
    p_type: type,
    p_id: id,
    p_reason: reason,
  });
  if (error) return { ok: false as const, message: say(error.message) };
  return { ok: true as const };
}

/**
 * 차단. 누르는 즉시 그 사람 글이 나에게만 사라진다.
 *
 * 거르는 건 RLS 가 한다 — 화면마다 걸러 내면 한 군데만 빠뜨려도
 * 차단이 안 되는 것처럼 보인다.
 */
export async function blockAuthor(type: "post" | "comment", id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_author", {
    p_type: type,
    p_id: id,
  });
  if (error) return { ok: false as const, message: say(error.message) };
  revalidatePath("/community");
  return { ok: true as const };
}
