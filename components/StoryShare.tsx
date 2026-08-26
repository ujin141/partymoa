"use client";

import { useState } from "react";

/**
 * 티켓을 인스타 스토리로.
 *
 * **공유 시트에 파일을 그대로 넘긴다.** 링크만 넘기면 인스타가 스토리로
 * 못 받고 DM 으로 간다. 이미지를 받아서 File 로 만들어 넘겨야 스토리에
 * 바로 올라간다.
 *
 * 파일 공유를 못 하는 브라우저(데스크톱 크롬 등)는 새 탭으로 연다.
 * 거기서 저장하거나 캡처하면 된다 — "안 된다" 로 끝내지 않는다.
 */
export function StoryShare({
  code,
  title,
}: {
  code: string;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const url = `/tickets/${code}/story`;

  async function share() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const file = new File([blob], `${code}.png`, { type: "image/png" });

      // canShare 로 먼저 물어본다. 안 물어보고 share 를 부르면 파일을
      // 못 받는 기기에서 그냥 실패한다
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      // 사용자가 공유 시트를 닫은 것은 오류가 아니다
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr("이미지를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line">
      <div className="flex">
        <button
          type="button"
          disabled={busy}
          onClick={share}
          className="flex flex-1 items-center justify-center gap-2 py-3.5 text-[14px] font-bold text-brand disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
          </svg>
          {busy ? "만드는 중…" : "스토리에 공유"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex-none border-l border-line px-5 py-3.5 text-[14px] font-semibold text-sub"
        >
          이미지 보기
        </a>
      </div>
      {err ? (
        <p className="px-4 pb-3 text-[12.5px] font-semibold text-hot">{err}</p>
      ) : null}
    </div>
  );
}
