"use client";

import { useEffect, useState } from "react";

/**
 * 인스타·카톡 안에서 열린 브라우저인지.
 *
 * **구글이 이런 브라우저에서 로그인을 막는다**(disallowed_useragent).
 * 우리 잘못이 아니라 구글 정책이라 우회할 방법이 없다. 그런데 우리
 * 손님은 대부분 인스타 프로필 링크로 들어온다 — 그러면 로그인 버튼이
 * 그냥 안 먹는 것처럼 보인다.
 *
 * 그래서 **누르기 전에** 말해 준다. 누르고 나서 알려 주면 이미 구글
 * 오류 화면을 한 번 본 뒤다.
 */
function detect() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return "카카오톡";
  if (/Instagram/i.test(ua)) return "인스타그램";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "페이스북";
  if (/NAVER\(inapp/i.test(ua)) return "네이버";
  if (/Line\//i.test(ua)) return "라인";
  if (/DaumApps/i.test(ua)) return "다음";
  return null;
}

export function InAppBrowserNotice() {
  const [app, setApp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setApp(detect()), []);
  if (!app) return null;

  const url = typeof window === "undefined" ? "" : window.location.href;
  const android = /Android/i.test(navigator.userAgent);

  return (
    <div className="mb-4 rounded-xl bg-[#FFF6E0] px-4 py-3.5 text-[13px] leading-relaxed text-[#7A5A00]">
      <b className="block text-[13.5px]">
        {`${app} 안에서는 구글 로그인이 안 돼요`}
      </b>
      <span className="mt-1 block">
        구글이 막아 둔 것이라 여기서는 방법이 없어요. 사파리나 크롬으로
        열면 됩니다.
      </span>

      {android ? (
        <a
          href={`intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`}
          className="mt-2.5 block rounded-lg bg-white py-2.5 text-center text-[13px] font-bold text-ink"
        >
          크롬으로 열기
        </a>
      ) : (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              // 클립보드를 막아 둔 브라우저가 있다
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="mt-2.5 w-full rounded-lg bg-white py-2.5 text-[13px] font-bold text-ink"
        >
          {copied ? "복사됐어요 — 사파리에 붙여 넣으세요" : "주소 복사"}
        </button>
      )}

      <span className="mt-2 block text-[12px]">
        오른쪽 위 · · · 를 눌러 <b>다른 브라우저로 열기</b>를 골라도 됩니다.
      </span>
    </div>
  );
}
