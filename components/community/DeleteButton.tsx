"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  removeComment,
  removePost,
} from "@/app/(guest)/community/actions";

export function DeleteButton({
  id,
  postId,
  kind,
  redirectTo,
}: {
  id: string;
  /** 댓글일 때 갱신할 글 id */
  postId?: string;
  kind: "post" | "comment";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!window.confirm("지울까요? 되돌릴 수 없어요.")) return;
          start(async () => {
            const r =
              kind === "post"
                ? await removePost(id)
                : await removeComment(id, postId!);
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            if (redirectTo) router.push(redirectTo);
            router.refresh();
          });
        }}
        className="-m-2 p-2 text-[12.5px] text-sub"
      >
        삭제
      </button>
      {err ? (
        <span className="ml-2 text-[12px] font-semibold text-hot">{err}</span>
      ) : null}
    </>
  );
}
