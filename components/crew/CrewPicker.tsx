"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import type { Crew } from "@/types/database";

/**
 * 헤더의 크루 이름. 레이아웃은 searchParams 를 못 받아서 늘 첫 크루를
 * 보여 준다 — 고른 크루와 어긋난다. 클라이언트에서 덮어쓴다.
 */
export function CrewNameSync({ name }: { name: string }) {
  useEffect(() => {
    const el = document.getElementById("crew-name");
    if (el) el.textContent = name;
  }, [name]);
  return null;
}

/**
 * 크루 고르기. 한 사람이 크루 여럿에 속할 때만 뜬다.
 *
 * 크루를 바꾸면 **행사 선택(?e=)을 버린다.** 안 버리면 A 크루의 행사 id 를
 * 들고 B 크루 화면으로 넘어가 빈 화면이 뜬다.
 */
export function CrewPicker({
  crews,
  current,
}: {
  crews: Crew[];
  current: string;
}) {
  const shown = crews.find((c) => c.id === current);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  if (crews.length <= 1) return null;

  return (
    <>
      {shown ? <CrewNameSync name={shown.name} /> : null}
      <div className="flex items-center gap-2 border-b border-line bg-soft px-4 py-2">
        <span className="text-[12.5px] text-sub">크루</span>
        <select
          value={current}
          onChange={(e) => {
            const next = new URLSearchParams(sp);
            next.set("c", e.target.value);
            next.delete("e");
            router.push(`${path}?${next.toString()}`);
          }}
          className="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-[13.5px] font-semibold"
        >
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
