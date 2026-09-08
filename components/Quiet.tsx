"use client";

import { useEffect } from "react";

/**
 * 콘솔을 닫아 둔다.
 *
 * **브라우저 콘솔 자체는 못 막는다** — 손님 브라우저는 손님 것이다.
 * 할 수 있는 건 셋이다.
 *  1. 열어도 아무것도 안 찍히게 한다. console 의 출력 함수를 빈 함수로
 *     바꾼다. 앱 코드가 남기는 로그, 라이브러리가 남기는 잡음 다 사라진다.
 *  2. 단축키(F12 · Ctrl+Shift+I/J/C · Ctrl+U)로는 안 열리게 한다.
 *     메뉴로는 열린다. 그래도 "무심코 열어 보는" 사람은 여기서 걸린다.
 *  3. 처음 한 번 경고를 찍는다. 누가 "여기 이거 붙여넣으면 쿠폰 나와요"
 *     하고 시키는 셀프 XSS 를 막는 유일한 방법이 이 한 줄이다.
 *
 * 개발 중에는 켜지 않는다. 로그가 안 보이면 개발이 안 된다.
 *
 * 진짜 방어는 여기가 아니다. 콘솔에서 뭘 해도 서버가 막아야 한다 —
 * RLS · 함수 권한 · 라우트 검사가 그 일을 한다. 이건 문 앞의 커튼이다.
 */
export function Quiet() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const c = console;
    const warn = c.warn.bind(c);
    warn(
      "%c멈추세요.",
      "color:#d33;font-size:40px;font-weight:900",
    );
    warn(
      "%c누가 여기에 뭘 붙여넣으라고 했다면 그건 사기예요. 붙여넣는 순간 계정과 예매 정보가 그 사람에게 넘어갈 수 있어요.",
      "font-size:15px",
    );
    const mute = () => {};
    for (const k of [
      "log", "info", "debug", "table", "dir", "dirxml", "trace",
      "group", "groupCollapsed", "groupEnd", "count", "time", "timeEnd", "timeLog",
    ] as const) {
      try {
        (c as unknown as Record<string, unknown>)[k] = mute;
      } catch {
        // 어떤 브라우저는 읽기 전용이다. 그러면 그냥 둔다
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      const mod = e.ctrlKey || e.metaKey;
      if (
        e.key === "F12" ||
        (mod && e.shiftKey && (k === "I" || k === "J" || k === "C" || k === "K")) ||
        (mod && !e.shiftKey && k === "U")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return null;
}
