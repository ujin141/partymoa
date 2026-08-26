"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/crew", label: "현황" },
  { href: "/crew/list", label: "명단" },
  { href: "/crew/promo", label: "홍보" },
  { href: "/crew/checkin", label: "입장" },
  { href: "/crew/settle", label: "정산" },
];

/** 어느 탭으로 가도 보고 있는 크루(?c=)와 행사(?e=)를 놓치지 않는다 */
export function CrewTabs() {
  const path = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["c", "e"]) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const q = keep.toString();

  return (
    <nav className="grid flex-none grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => {
        const on = t.href === "/crew" ? path === "/crew" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={q ? `${t.href}?${q}` : t.href}
            className={`py-3.5 text-center text-[13px] font-semibold ${
              on ? "text-brand" : "text-[#9AA0AA]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
