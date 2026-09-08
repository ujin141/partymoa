import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CommentListRow, PostListRow } from "@/types/database";

const PAGE = 30;

export async function listPosts(page = 0): Promise<PostListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("post_list")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  return (data ?? []) as PostListRow[];
}

export async function getPost(id: string): Promise<PostListRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("post_list")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PostListRow) ?? null;
}

/** 댓글. 표 대신 뷰로 읽는다 — 글쓴이 uuid 는 안 나오고 mine 만 온다 */
export async function listComments(postId: string): Promise<CommentListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comment_list")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []) as CommentListRow[];
}

/** 지금 세션의 uid. 본인 글에만 삭제 버튼을 보여 주려고 쓴다 */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
