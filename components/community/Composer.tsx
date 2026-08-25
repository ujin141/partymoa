"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { writeComment, writePost } from "@/app/(guest)/community/actions";

const NICK_KEY = "partymoa:nick";

/** 닉네임은 매번 다시 치게 하지 않는다. 예매 정보가 아니라 기기 편의값이다 */
function useNickname() {
  const [nick, setNick] = useState("");
  useEffect(() => {
    setNick(localStorage.getItem(NICK_KEY) ?? "");
  }, []);
  const remember = (v: string) => {
    setNick(v);
    try {
      localStorage.setItem(NICK_KEY, v);
    } catch {
      // 사파리 프라이빗 모드에서 막힌다. 닉네임은 못 외워도 글은 써진다
    }
  };
  return [nick, remember] as const;
}

const box =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

export function PostComposer() {
  const router = useRouter();
  const [nick, setNick] = useNickname();
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-4 mt-3.5 block w-[calc(100%-2rem)] rounded-xl bg-soft px-3.5 py-3 text-left text-[14.5px] text-sub"
      >
        무슨 얘기든 편하게 써 주세요
      </button>
    );
  }

  return (
    <div className="mx-4 mt-3.5 rounded-xl border border-line p-3.5">
      <input
        value={nick}
        maxLength={20}
        onChange={(e) => setNick(e.target.value)}
        placeholder="닉네임"
        className={`${box} mb-2`}
      />
      <textarea
        value={body}
        maxLength={2000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="무슨 얘기든 편하게"
        className={`${box} h-28 resize-none`}
      />
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          className="flex-none rounded-xl border border-line px-4 py-3 text-[14.5px] font-semibold text-sub"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy || !nick.trim() || !body.trim()}
          onClick={() =>
            start(async () => {
              const r = await writePost(nick, body, null);
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setBody("");
              setOpen(false);
              setErr(null);
              router.refresh();
            })
          }
          className="flex-1 rounded-xl bg-brand py-3 text-[15px] font-bold text-white disabled:bg-[#C8CBD2]"
        >
          {busy ? "올리는 중…" : "올리기"}
        </button>
      </div>
    </div>
  );
}

export function CommentComposer({ postId }: { postId: string }) {
  const router = useRouter();
  const [nick, setNick] = useNickname();
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="flex-none border-t border-line bg-white px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5">
      {err ? (
        <p className="mb-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <div className="flex gap-2">
        <input
          value={nick}
          maxLength={20}
          onChange={(e) => setNick(e.target.value)}
          placeholder="닉네임"
          className="w-24 flex-none rounded-xl bg-soft p-3 text-[14px] outline-none"
        />
        <input
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || busy || !nick.trim() || !body.trim())
              return;
            e.preventDefault();
            start(async () => {
              const r = await writeComment(postId, nick, body);
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setBody("");
              setErr(null);
              router.refresh();
            });
          }}
          placeholder="댓글 달기"
          className="min-w-0 flex-1 rounded-xl bg-soft p-3 text-[14.5px] outline-none"
        />
        <button
          type="button"
          disabled={busy || !nick.trim() || !body.trim()}
          onClick={() =>
            start(async () => {
              const r = await writeComment(postId, nick, body);
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setBody("");
              setErr(null);
              router.refresh();
            })
          }
          className="flex-none rounded-xl bg-brand px-4 py-3 text-[14.5px] font-bold text-white disabled:bg-[#C8CBD2]"
        >
          등록
        </button>
      </div>
    </div>
  );
}
