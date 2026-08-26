"use client";

import { useState, useTransition } from "react";

import { writeReview } from "@/app/(guest)/party/[slug]/actions";
import { ago } from "@/lib/format";
import type { Review } from "@/types/database";

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span
      aria-label={`5점 만점에 ${n}점`}
      className="tracking-[0.06em] text-[#FFB300]"
      style={{ fontSize: size }}
    >
      {"★★★★★".slice(0, n)}
      <span className="text-[#DFE2E8]">{"★★★★★".slice(n)}</span>
    </span>
  );
}

/**
 * 파티 후기.
 *
 * **예매한 사람만 쓴다.** 안 온 사람이 쓰는 후기는 다음 파티를 고르는
 * 데 도움이 안 되고, 경쟁 호스트가 깎는 통로가 된다. 자격 판정은 서버가
 * 하고(can_review), 여기서는 쓸 수 있는 사람에게만 칸을 띄운다.
 *
 * 자격이 없는 사람에게 칸을 띄워 놓고 눌렀을 때 막는 건 나쁜 화면이다 —
 * 다 적고 나서 못 쓴다는 말을 듣게 된다.
 */
export function Reviews({
  eventId,
  slug,
  reviews,
  canWrite,
  mine,
  defaultNickname,
  started,
}: {
  eventId: string;
  slug: string;
  reviews: Review[];
  canWrite: boolean;
  mine: boolean;
  defaultNickname: string;
  started: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState(defaultNickname);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();

  const avg = reviews.length
    ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return (
    <section id="후기" className="scroll-mt-2 border-b-8 border-soft px-4 py-4.5">
      <div className="mb-3 flex items-baseline gap-2">
        <h4 className="text-base font-extrabold">후기</h4>
        {reviews.length ? (
          <>
            <Stars n={Math.round(avg)} />
            <span className="text-[13px] font-bold">{avg}</span>
            <span className="text-[12.5px] text-sub">{`${reviews.length}개`}</span>
          </>
        ) : null}
      </div>

      {done ? (
        <p className="mb-4 rounded-xl bg-[#E7F7EF] px-4 py-3.5 text-[13.5px] text-ok">
          후기 남겼어요. 고맙습니다.
        </p>
      ) : canWrite && !mine ? (
        open ? (
          <div className="mb-5 rounded-xl border border-line p-3.5">
            <div className="mb-2.5 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n}점`}
                  onClick={() => setRating(n)}
                  className={`text-[26px] leading-none ${
                    n <= rating ? "text-[#FFB300]" : "text-[#DFE2E8]"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <input
              className="mb-2 w-full rounded-xl bg-soft p-3 text-[14.5px] outline-none"
              value={nickname}
              maxLength={20}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
            />
            <textarea
              className="min-h-[100px] w-full resize-y rounded-xl bg-soft p-3 text-[14.5px] outline-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="어땠는지 적어 주세요. 다음에 갈 사람이 봅니다."
            />
            {err ? (
              <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
            ) : null}
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-semibold text-sub"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy || rating === 0 || body.trim().length < 5}
                onClick={() =>
                  start(async () => {
                    setErr(null);
                    const r = await writeReview({
                      eventId,
                      slug,
                      rating,
                      body,
                      nickname,
                    });
                    if (!r.ok) {
                      setErr(r.message);
                      return;
                    }
                    setDone(true);
                  })
                }
                className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-bold text-white disabled:bg-[#C8CBD2]"
              >
                {busy ? "올리는 중…" : "남기기"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mb-5 w-full rounded-xl border border-brand py-3 text-[14.5px] font-bold text-brand"
          >
            후기 남기기
          </button>
        )
      ) : null}

      {reviews.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] leading-relaxed text-sub">
          {started
            ? "아직 후기가 없어요."
            : "파티가 끝나면 다녀온 사람들의 후기가 여기 올라옵니다."}
        </p>
      ) : (
        reviews.map((r) => (
          <div
            key={r.id}
            className="border-b border-line py-3 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <Stars n={r.rating} size={13} />
              <b className="text-[13.5px] font-bold">{r.nickname}</b>
              <span className="ml-auto text-[12px] text-sub">
                {ago(r.created_at)}
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">
              {r.body}
            </p>
          </div>
        ))
      )}
    </section>
  );
}
