"use client";

import { useState, useTransition } from "react";

import { blockAuthor, reportContent } from "@/app/(guest)/community/actions";

const REASONS = [
  "욕설·혐오 표현",
  "광고·홍보",
  "음란물",
  "사기·허위 정보",
  "개인정보 노출",
  "그 밖의 이유",
];

/**
 * 신고와 차단.
 *
 * **둘 다 있어야 한다.** 신고는 운영자가 볼 때까지 시간이 걸리는데,
 * 불쾌한 걸 방금 본 사람이 원하는 건 "지금 안 보이게" 다. 그게 차단이다.
 * 신고만 두면 눌러 놓고도 그 글이 계속 보인다.
 *
 * 이유는 고르게 한다. 빈 칸을 주면 대부분 아무것도 안 적고 넘어가고,
 * 그러면 운영자가 왜 신고됐는지 모른 채 글만 받는다.
 */
export function ReportMenu({
  type,
  id,
  mine,
}: {
  type: "post" | "comment";
  id: string;
  /** 내 글이면 신고·차단이 의미가 없다 */
  mine?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (mine) return null;

  function close() {
    setOpen(false);
    setReason(null);
    setMsg(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="신고하거나 차단하기"
        className="-m-2 flex-none p-2 text-[15px] leading-none text-[#B4B8C2]"
      >
        ⋯
      </button>

      {open ? (
        <div
          onClick={close}
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0a0c10]/45"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="신고·차단"
            className="w-full max-w-[430px] rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            {msg ? (
              <>
                <p className="py-2 text-[14.5px] font-semibold leading-relaxed">
                  {msg}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 w-full rounded-xl bg-ink py-3.5 text-[15px] font-bold text-white"
                >
                  닫기
                </button>
              </>
            ) : reason ? (
              <>
                <b className="block text-[16px] font-extrabold">신고할까요?</b>
                <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
                  {`사유: ${reason}`}
                  <br />
                  운영자가 확인하고 처리합니다. 글은 지금 바로 사라지지
                  않아요 — 당장 안 보이게 하려면 차단을 쓰세요.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReason(null)}
                    className="rounded-xl border border-line py-3 text-[14.5px] font-semibold text-sub"
                  >
                    뒤로
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const r = await reportContent(type, id, reason);
                        setMsg(
                          r.ok
                            ? "신고했어요. 확인하고 처리하겠습니다."
                            : r.message,
                        );
                      })
                    }
                    className="rounded-xl bg-hot py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "보내는 중…" : "신고"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <b className="block text-[16px] font-extrabold">
                  이 글을 신고하거나 차단합니다
                </b>
                <div className="mt-3.5 grid gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="rounded-xl bg-soft py-3 text-[14.5px] font-semibold"
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await blockAuthor(type, id);
                      setMsg(
                        r.ok
                          ? "차단했어요. 이 사람 글은 이제 안 보입니다."
                          : r.message,
                      );
                    })
                  }
                  className="mt-3 w-full rounded-xl border border-hot py-3 text-[14.5px] font-bold text-hot disabled:opacity-50"
                >
                  {busy ? "처리 중…" : "이 사람 차단"}
                </button>
                <p className="mt-2 text-center text-[12px] leading-relaxed text-sub">
                  차단하면 이 사람 글과 댓글이 나에게만 안 보입니다.
                  상대는 알 수 없어요.
                </p>

                <button
                  type="button"
                  onClick={close}
                  className="mt-3 w-full py-2.5 text-[14px] font-semibold text-sub"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
