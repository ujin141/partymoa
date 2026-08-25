"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "홈",
    icon: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  },
  {
    href: "/explore",
    label: "둘러보기",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  },
  {
    href: "/community",
    label: "커뮤니티",
    icon: (
      <>
        <path d="M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H8l-4 3z" />
        <path d="M18.5 9H20a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 20 17h-1v3l-3.2-3H11" />
      </>
    ),
  },
  {
    href: "/tickets",
    label: "내 티켓",
    icon: (
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4z" />
    ),
  },
  {
    href: "/my",
    label: "마이",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
      </>
    ),
  },
];

export function GuestTabs() {
  const path = usePathname();
  return (
    <nav className="grid flex-none grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => {
        const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on}
            /* 다섯 칸이라 375px 에서 글자가 빠듯하다. 10.5px 이 줄바꿈 없이
               들어가는 마지노선이었다 */
            className={`grid justify-items-center gap-1 py-2.5 pb-3 text-[10.5px] font-semibold ${
              on ? "text-brand" : "text-[#9AA0AA]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[22px] w-[22px] fill-none stroke-current stroke-[1.8]"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {t.icon}
            </svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
