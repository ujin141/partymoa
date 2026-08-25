import Link from "next/link";

import { PostComposer } from "@/components/community/Composer";
import { Empty } from "@/components/ui/primitives";
import { currentUserId, listPosts } from "@/lib/community";
import { ago } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "커뮤니티" };

export default async function CommunityPage() {
  const [posts, uid] = await Promise.all([listPosts(), currentUserId()]);

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3.5">
        <span className="text-[17px] font-extrabold">커뮤니티</span>
        <span className="ml-auto text-[13px] text-sub">{posts.length}개</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <PostComposer />

        {posts.length === 0 ? (
          <Empty>
            아직 글이 없어요.
            <br />첫 글을 써 보세요.
          </Empty>
        ) : (
          <div className="mt-3.5">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/community/${p.id}`}
                className="block border-b border-line px-4 py-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold">{p.nickname}</span>
                  {uid && p.user_id === uid ? (
                    <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                      내 글
                    </span>
                  ) : null}
                  <span className="ml-auto text-[12.5px] text-sub">
                    {ago(p.created_at)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[14.5px] leading-relaxed">
                  {p.body}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[12.5px] text-sub">
                  <span>댓글 {p.comment_count}</span>
                  {p.event_title ? (
                    <span className="truncate rounded bg-soft px-1.5 py-0.5">
                      {p.event_title}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="h-4" />
      </div>
    </>
  );
}
