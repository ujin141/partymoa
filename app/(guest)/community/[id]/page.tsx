import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentComposer } from "@/components/community/Composer";
import { DeleteButton } from "@/components/community/DeleteButton";
import { ReportMenu } from "@/components/community/ReportMenu";
import { currentUserId, getPost, listComments } from "@/lib/community";
import { ago } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const [comments, uid] = await Promise.all([
    listComments(id),
    currentUserId(),
  ]);

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/community" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">글</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <article className="border-b-8 border-soft px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-bold">{post.nickname}</span>
            <span className="text-[12.5px] text-sub">
              {ago(post.created_at)}
            </span>
            <span className="ml-auto flex items-center gap-1">
              {uid && post.user_id === uid ? (
                <DeleteButton id={post.id} kind="post" redirectTo="/community" />
              ) : (
                <ReportMenu type="post" id={post.id} />
              )}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15.5px] leading-7">
            {post.body}
          </p>
          {post.event_slug ? (
            <Link
              href={`/party/${post.event_slug}`}
              className="mt-3.5 flex items-center gap-2 rounded-xl bg-soft px-3.5 py-3"
            >
              <span className="truncate text-[14px] font-semibold">
                {post.event_title}
              </span>
              <span className="ml-auto text-[19px] text-[#C0C4CC]">›</span>
            </Link>
          ) : null}
        </article>

        <div className="px-4 pt-4">
          <h4 className="mb-1 text-[15px] font-extrabold">
            댓글 {comments.length}
          </h4>
        </div>

        {comments.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-sub">
            첫 댓글을 달아 보세요.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-bold">{c.nickname}</span>
                <span className="text-[12px] text-sub">{ago(c.created_at)}</span>
                <span className="ml-auto flex items-center gap-1">
                  {uid && c.user_id === uid ? (
                    <DeleteButton id={c.id} postId={post.id} kind="comment" />
                  ) : (
                    <ReportMenu type="comment" id={c.id} />
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed">
                {c.body}
              </p>
            </div>
          ))
        )}
        <div className="h-4" />
      </div>

      <CommentComposer postId={post.id} />
    </>
  );
}
