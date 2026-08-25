"use client";

import { useEffect } from "react";

import { Symbol } from "@/components/Symbol";

/**
 * 오류 화면. **원인 문자열을 손님에게 보여 주지 않는다** — 서버 메시지에
 * 테이블 이름이나 제약 이름이 섞여 나온다. 개발 중에만 콘솔로 흘린다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid h-dvh max-w-[430px] place-items-center bg-white px-6 text-center">
      <div>
        <Symbol size={48} className="mx-auto opacity-30" />
        <h1 className="mt-5 text-[20px] font-extrabold">
          잠깐 문제가 생겼어요
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
          다시 시도해 보시고, 계속 안 되면 잠시 뒤에 열어 주세요.
        </p>
        <div className="mt-6 grid gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-brand px-6 py-3.5 text-[15px] font-bold text-white"
          >
            다시 시도
          </button>
          {/* Link 가 아니라 <a> 다. 오류가 난 뒤에는 클라이언트 트리가
              망가져 있을 수 있어 통째로 다시 받는 편이 안전하다 */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="rounded-xl border border-line px-6 py-3.5 text-[15px] font-semibold text-sub"
          >
            홈으로
          </a>
        </div>
        {error.digest ? (
          <p className="mt-5 text-[11px] text-[#C0C4CC]">
            오류 번호 {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
