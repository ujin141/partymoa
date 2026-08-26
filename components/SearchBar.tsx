"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * 검색. 타이핑마다 서버로 던지면 목록이 덜덜 떨려서 300ms 묶어 보낸다.
 * 주소에 남기므로 뒤로 가기와 공유가 그대로 된다.
 *
 * 아이콘은 **입력창을 기준으로** 앉힌다. 바깥 여백(px-4, pt-3.5)까지 포함한
 * 상자에 절대배치하면 위아래 가운데가 안 맞아 손으로 밀어야 하고, 그렇게
 * 밀면 글자 크기가 바뀔 때마다 또 어긋난다.
 */
export function SearchBar({ placeholder = "파티, 장소, 호스트 검색" }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    // 첫 렌더에서 곧바로 밀어 넣으면 주소가 한 번 덧칠된다
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp);
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      router.replace(`${path}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // sp 를 넣으면 칩을 누를 때마다 타이머가 다시 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="px-4 pt-3.5">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 fill-none stroke-sub stroke-2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          className="w-full rounded-xl bg-soft py-3 pl-11 pr-10 text-[14.5px] outline-none focus:bg-white focus:ring-2 focus:ring-brand"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="지우기"
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-[#C8CBD2] text-[13px] leading-none text-white"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
