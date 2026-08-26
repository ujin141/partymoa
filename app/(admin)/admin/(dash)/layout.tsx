import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import { Symbol } from "@/components/Symbol";
import { requireAdmin } from "@/lib/admin";
import { myCrews } from "@/lib/crew";

/**
 * 운영자 화면 셸. **크루 화면과 다른 자격이다.**
 *
 * 크루는 자기 파티의 손님만 본다. 운영자는 전 크루의 매출과 수수료를
 * 본다. 그래서 로그인 문(`/admin/login`)도 따로 두고, 배지 색도 다르게
 * 한다 — 지금 어느 자격으로 보고 있는지 화면만 보고 알아야 한다.
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
  // 한 사람이 운영자이면서 크루이기도 하다(우진). 두 화면은 권한이 다르니
  // 갈라 두되, 오갈 문은 만들어 둔다
  const crews = await myCrews();

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
        {crews.length ? (
          <Link
            href="/crew"
            className="ml-3 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-semibold text-sub"
          >
            크루 화면
          </Link>
        ) : null}
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
