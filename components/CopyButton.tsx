"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // 클립보드를 막아 둔 브라우저가 있다. 이 경우 사용자가 직접 고른다
          return;
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="flex-none rounded-lg border border-line px-3 py-2 text-[13px] font-semibold"
    >
      {done ? "복사됨" : label}
    </button>
  );
}
