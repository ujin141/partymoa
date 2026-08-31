"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "partymoa:rules";

/**
 * 글 쓰기 전 한 번 받는 동의.
 *
 * **여기가 진짜 관문이다.** 이 앱은 커뮤니티 글을 로그인 없이도 쓸 수
 * 있다. 그래서 로그인 화면에만 약관 동의를 붙이면, 한 번도 로그인하지
 * 않은 사람이 약관을 본 적 없이 글을 올린다 — 애플 가이드라인 1.2 가
 * 요구하는 "가입·로그인 전 동의" 가 실제로는 안 걸린다.
 *
 * 한 번 누르면 그 기기에서는 다시 안 묻는다. 매번 물으면 글쓰기가
 * 숙제가 되고, 그건 커뮤니티를 죽인다.
 */
export function Rules({ onAgree }: { onAgree: () => void }) {
  const [need, setNeed] = useState<boolean | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      // 프라이빗 모드. 이번에 한 번 더 묻는다
    }
    if (seen) onAgree();
    setNeed(!seen);
    // onAgree 는 부모가 매번 새로 만든다. 넣으면 무한히 다시 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (need !== true) return null;

  return (
    <div className="mx-4 mt-3.5 rounded-xl border border-line p-4">
      <h4 className="text-[15px] font-extrabold">글을 올리기 전에</h4>
      <p className="mt-2 text-[13.5px] leading-relaxed text-sub">
        <b className="text-ink">
          불쾌감을 주는 글과 남을 괴롭히는 행동은 용납하지 않습니다.
        </b>{" "}
        욕설·비방·혐오 표현, 성적인 내용, 위협이나 스토킹, 남의 신상을
        퍼뜨리는 글은 예외 없이 지웁니다.
      </p>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-sub">
        신고가 들어오면 <b className="text-ink">24시간 안에 확인하고</b> 내리며,
        반복되면 예고 없이 이용을 정지합니다. 불쾌한 글을 보면 글 옆{" "}
        <b className="text-ink">⋯</b> 에서 신고하거나 그 사람을 차단하세요 —
        차단하면 즉시 안 보입니다.
      </p>
      <p className="mt-2.5 text-[12.5px] text-sub">
        <Link href="/terms" className="underline">
          이용약관
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // 못 외워도 이번 글은 올라간다
          }
          setNeed(false);
          onAgree();
        }}
        className="mt-3.5 w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white"
      >
        동의하고 글쓰기
      </button>
    </div>
  );
}
