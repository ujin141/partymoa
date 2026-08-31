"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "partymoa:agreed";

/** 한 번 동의했으면 다시 안 묻는다. 기기 편의값이라 서버에 안 보낸다 */
export function hasAgreed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function remember() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // 사파리 프라이빗 모드. 동의는 이번만 유지되고 다음에 다시 묻는다
  }
}

/**
 * 약관 동의 문.
 *
 * **애플이 요구한다.** 사용자끼리 글을 주고받는 앱은 가입·로그인 전에
 * 약관에 동의를 받아야 하고, 그 약관에 "불쾌한 콘텐츠와 남을 괴롭히는
 * 이용자는 용납하지 않는다"가 적혀 있어야 한다(가이드라인 1.2).
 *
 * 예전에는 버튼 아래에 "로그인하면 동의하는 것으로 봅니다" 한 줄이
 * 있었다. **읽은 적 없는 사람에게 동의를 씌우는 문장**이고, 심사에서
 * 그건 동의로 안 쳐 준다. 눌러야 넘어가게 바꾼다.
 *
 * 체크가 없으면 아래 버튼들이 안 눌린다 — 버튼을 숨기지는 않는다.
 * 숨기면 왜 로그인이 없는지 모른 채 나간다.
 */
export function Agree({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOk(hasAgreed());
    setReady(true);
  }, []);

  return (
    <>
      <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-soft px-3.5 py-3">
        <input
          type="checkbox"
          checked={ok}
          onChange={(e) => {
            setOk(e.target.checked);
            if (e.target.checked) remember();
          }}
          className="mt-0.5 h-[18px] w-[18px] flex-none accent-brand"
        />
        <span className="text-[13px] leading-relaxed text-sub">
          <Link href="/terms" className="font-bold text-ink underline">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="font-bold text-ink underline">
            개인정보처리방침
          </Link>
          에 동의합니다.
          <br />
          <b className="text-ink">
            불쾌감을 주는 콘텐츠와 남을 괴롭히는 이용자는 용납하지 않습니다.
          </b>{" "}
          신고가 들어오면 24시간 안에 확인하고 내립니다.
        </span>
      </label>

      {/* 안 눌렀으면 못 누르게. 눌러 보고 나서 왜 안 되는지 알게 되는 게
          아니라, 위에 무엇을 해야 하는지가 먼저 보여야 한다 */}
      <div
        className={ready && ok ? "" : "pointer-events-none opacity-45"}
        aria-disabled={!ok}
      >
        {children}
      </div>
      {ready && !ok ? (
        <p className="mt-2 text-center text-[12.5px] text-sub">
          위 약관에 동의해야 로그인할 수 있어요.
        </p>
      ) : null}
    </>
  );
}
