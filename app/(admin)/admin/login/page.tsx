import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { LogoutButton } from "@/components/LogoutButton";
import { Symbol } from "@/components/Symbol";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "운영자 로그인", robots: { index: false } };

/**
 * 운영자 전용 문. **크루 로그인과 갈라 둔다.**
 *
 * 이 화면만 `(dash)` 레이아웃 밖에 있다 — 그 레이아웃이 requireAdmin 을
 * 부르기 때문에 안에 두면 로그인하러 오는 사람이 로그인 화면으로 무한히
 * 되돌아간다.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; error?: string }>;
}) {
  const [{ denied, error }, admin] = await Promise.all([searchParams, isAdmin()]);
  if (admin) redirect("/admin");

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] sm:border-x sm:border-line">
      <header className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
        <Symbol size={22} />
        <span className="text-[17px] font-extrabold">
          파티<span className="text-brand">모아</span>
        </span>
        <span className="rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
          운영
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-10">
        <h1 className="text-[24px] font-extrabold">운영자 로그인</h1>

        {denied ? (
          <>
            <p className="mt-3 rounded-xl bg-[#FDECEF] px-4 py-3.5 text-[13.5px] leading-relaxed text-hot">
              로그인은 됐지만 이 계정은 운영자가 아니에요. 파티를 여는
              크루라면 크루 화면으로 가세요.
            </p>
            <div className="mt-4 grid gap-2.5">
              <Link
                href="/crew"
                className="rounded-xl bg-ink py-3.5 text-center text-[15px] font-bold text-white"
              >
                크루 화면으로
              </Link>
              <LogoutButton
                to="/admin/login"
                className="rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold text-sub"
              />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14px] leading-relaxed text-sub">
              파티모아를 운영하는 사람만 쓰는 화면이에요. 전 크루의 예매·매출·
              수수료를 봅니다. 크루가 자기 파티를 관리하는 화면은{" "}
              <Link href="/crew/login" className="underline">
                크루 로그인
              </Link>{" "}
              쪽입니다.
            </p>
            {error ? (
              <p className="mt-4 rounded-xl bg-[#FDECEF] px-4 py-3.5 text-[13.5px] leading-relaxed text-hot">
                로그인이 안 됐어요 — {error}
              </p>
            ) : null}
            <div className="mt-6">
              <AdminLoginForm />
            </div>
            <p className="mt-5 text-[12.5px] leading-relaxed text-sub">
              운영자로 등록된 구글 계정만 들어갑니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
