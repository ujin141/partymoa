"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { FILTERS, type FilterKey } from "@/lib/filters";

/**
 * 필터 줄.
 *
 * **칩 일곱 개를 다 펼쳐 놓지 않는다.** 항목마다 고를 게 서너 개씩
 * 있으니 전부 펼치면 목록보다 필터가 길어진다. 칩 하나가 항목 하나고,
 * 누르면 아래에서 시트가 올라온다.
 *
 * 고른 게 있으면 칩에 그 값이 적힌다 — 접혀 있어도 지금 뭐가 걸려
 * 있는지 보여야 한다. 그게 안 보이면 "왜 파티가 두 개밖에 없지" 가
 * 된다.
 *
 * 값은 전부 주소창에 남는다. 호스트가 "이 링크로 들어와" 라고 쓸 수 있다.
 */
export function ExploreFilters({ areas }: { areas: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState<FilterKey | null>(null);

  // 지역은 파티가 실제로 있는 곳만. 없는 지역을 띄우면 빈 목록이 된다
  const defs = [
    {
      key: "area" as FilterKey,
      icon: "📍",
      label: "지역",
      options: areas.map((a) => ({ value: a, label: a })),
    },
    ...FILTERS,
  ].filter((f) => f.options.length > 0);

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const s = next.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
    setOpen(null);
  }

  const sheet = defs.find((f) => f.key === open);

  return (
    <>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2">
        {defs.map((f) => {
          const on = sp.get(f.key);
          const chosen = f.options.find((o) => o.value === on);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setOpen(f.key)}
              className={`flex flex-none items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition active:scale-95 ${
                chosen
                  ? "border-brand bg-brand-soft font-semibold text-brand"
                  : "border-line bg-white text-sub"
              }`}
            >
              <span aria-hidden="true">{f.icon}</span>
              {chosen ? chosen.label : f.label}
              <span className="text-[10px] leading-none opacity-60">▾</span>
            </button>
          );
        })}
      </div>

      {sheet ? (
        <div
          onClick={() => setOpen(null)}
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0a0c10]/45"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={sheet.label}
            className="w-full max-w-[430px] rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <b className="block text-[16px] font-extrabold">
              <span aria-hidden="true">{sheet.icon}</span> {sheet.label}
            </b>

            <div className="mt-3.5 grid gap-1.5">
              <button
                type="button"
                onClick={() => set(sheet.key, null)}
                className={`rounded-xl py-3 text-[14.5px] font-semibold ${
                  sp.get(sheet.key) ? "bg-soft" : "bg-ink text-white"
                }`}
              >
                전체
              </button>
              {sheet.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set(sheet.key, o.value)}
                  className={`rounded-xl py-3 text-[14.5px] font-semibold ${
                    sp.get(sheet.key) === o.value ? "bg-ink text-white" : "bg-soft"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(null)}
              className="mt-3 w-full py-2.5 text-[14px] font-semibold text-sub"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
