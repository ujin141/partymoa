import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import { Symbol } from "@/components/Symbol";
import { requireAdmin } from "@/lib/admin";

/**
 * 운영자 화면 셸.
 *
 * 크루 화면과 달리 **표를 본다.** 폰 폭에 억지로 우겨넣지 않고 가로로
 * 넓게 쓴다 — 운영자는 노트북에서 본다.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="mx-auto flex h-dvh max-w-[900px] flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] sm:border-x sm:border-line">
      <header className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
        <Symbol size={22} />
        <span className="text-[17px] font-extrabold">
          파티<span className="text-brand">모아</span>
        </span>
        <span className="rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
          운영
        </span>
        <nav className="ml-4 flex gap-3 text-[13.5px]">
          <Link href="/admin" className="font-semibold">
            현황
          </Link>
          <Link href="/admin/crews" className="text-sub">
            크루
          </Link>
          <Link href="/admin/community" className="text-sub">
            커뮤니티
          </Link>
        </nav>
        <span className="ml-auto">
          <LogoutButton
            to="/"
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-semibold text-sub"
          />
        </span>
      </header>
      {children}
    </div>
  );
}
