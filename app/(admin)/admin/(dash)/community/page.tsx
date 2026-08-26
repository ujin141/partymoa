import { HideButton } from "@/components/admin/HideButton";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PostComment, PostListRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "커뮤니티 관리" };

/**
 * 커뮤니티 신고·숨김.
 *
 * 게시판에는 본인 삭제밖에 없었다. 익명으로 쓴 글은 본인도 못 지우므로
 * 운영자가 내릴 수 있어야 한다. **행을 지우지 않고 숨긴다** — 지우면
 * 나중에 분쟁이 났을 때 뭐가 있었는지 확인할 수가 없다.
 */
export default async function AdminCommunityPage() {
  const supabase = await createClient();
  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabase
      .from("post_list")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("post_comments")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const list = (posts ?? []) as PostListRow[];
  const cs = (comments ?? []) as PostComment[];

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-3 pt-5">
        <h1 className="text-[21px] font-extrabold">커뮤니티</h1>
        <p className="mt-1 text-[13px] text-sub">
          내린 글은 목록에서 사라지지만 기록은 남습니다.
        </p>
      </div>

      <h2 className="px-4 pb-2 pt-3 text-[15px] font-extrabold">
        글 {list.length}
      </h2>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-sub">글이 없어요.</p>
      ) : (
        list.map((p) => (
          <div key={p.id} className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <b className="text-[14px] font-bold">{p.nickname}</b>
              <span className="text-[12px] text-sub">{ago(p.created_at)}</span>
              <span className="text-[12px] text-sub">
                댓글 {p.comment_count}
              </span>
              {!p.user_id ? (
                <span className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-sub">
                  익명
                </span>
              ) : null}
              <span className="ml-auto">
                <HideButton id={p.id} kind="post" />
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">
              {p.body}
            </p>
          </div>
        ))
      )}

      <h2 className="px-4 pb-2 pt-6 text-[15px] font-extrabold">
        댓글 {cs.length}
      </h2>
      {cs.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-sub">댓글이 없어요.</p>
      ) : (
        cs.map((c) => (
          <div key={c.id} className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <b className="text-[14px] font-bold">{c.nickname}</b>
              <span className="text-[12px] text-sub">{ago(c.created_at)}</span>
              <span className="ml-auto">
                <HideButton id={c.id} kind="comment" />
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">
              {c.body}
            </p>
          </div>
        ))
      )}
      <div className="h-8" />
    </div>
  );
}
