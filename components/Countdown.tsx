"use client";

import { useEffect, useState } from "react";

/**
 * 입금 마감까지 남은 시간.
 *
 * **서버에서 그리지 않는다.** 서버가 "3시간 12분 남음" 을 HTML 에 박으면
 * 그 순간이 캐시되고, 손님은 30분 뒤에도 3시간 12분을 본다.
 * 마운트 뒤 클라이언트에서만 계산한다 — 그래서 첫 프레임은 비워 둔다.
 */
export function Countdown({
  until,
  className = "",
}: {
  until: string;
  className?: string;
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(new Date(until).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  if (left === null) return <span className={className}>—</span>;
  if (left <= 0) {
    return <span className={className}>마감 지남</span>;
  }

  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);

  return (
    <span className={className}>
      {h > 0 ? `${h}시간 ` : ""}
      {m}분 {h > 0 ? "" : `${s}초 `}남음
    </span>
  );
}

/** 8월 27일 오후 11시 40분 — 언제까지인지 못 박아 주는 쪽이 더 안전하다 */
export function Deadline({ at }: { at: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(
      new Date(at).toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [at]);
  return <>{text}</>;
}
