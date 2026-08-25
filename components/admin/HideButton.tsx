"use client";

import { useState, useTransition } from "react";

import { hideComment, hidePost } from "@/app/(admin)/admin/actions";

export function HideButton({
  id,
  kind,
}: {
  id: string;
  kind: "post" | "comment";
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!window.confirm("이 글을 내릴까요? 목록에서 사라집니다."))
            return;
          start(async () => {
            const r = kind === "post" ? await hidePost(id) : await hideComment(id);
            if (!r.ok) setErr(r.message);
          });
        }}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-hot"
      >
        내리기
      </button>
      {err ? (
        <span className="ml-2 text-[12px] font-semibold text-hot">{err}</span>
      ) : null}
    </>
  );
}
