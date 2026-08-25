import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import { Symbol } from "@/components/Symbol";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "마이" };

const ROWS = [
  { label: "찜한 파티", href: "/my/favorites" },
  { label: "팔로우한 크루", href: "/my/crews" },
  { label: "알림 설정", href: "/my/alerts" },
  { label: "고객센터", href: "/my/help" },
];

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 익명 세션은 "로그인" 으로 치지 않는다. 기기에 묶여 있을 뿐이다
  const signedIn = Boolean(user && !user.is_anonymous);

  // 크루 소유자·멤버면 관리자로, 운영자면 운영 화면으로 넘어가는 줄을 띄운다
  let staff = false;
  let admin = false;
  if (user) {
    const [{ count }, { data: adminRow }] = await Promise.all([
      supabase
        .from("crew_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    staff = (count ?? 0) > 0;
    admin = Boolean(adminRow);
  }

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3.5">
        <span className="text-[17px] font-extrabold">마이</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="border-b-8 border-soft px-4 py-5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft">
              <Symbol size={26} />
            </div>
            <div className="min-w-0">
              <b className="block truncate text-[17px] font-extrabold">
                {signedIn ? (user?.email ?? "회원") : "게스트"}
              </b>
              <p className="mt-0.5 text-[13px] text-sub">
                {signedIn ? "로그인됨" : "로그인 없이 예매하고 있어요"}
              </p>
            </div>
          </div>

          {!signedIn ? (
            <Link
              href="/login"
              className="mt-4 block rounded-xl bg-brand py-3.5 text-center text-[15px] font-bold text-white"
            >
              로그인하기
            </Link>
          ) : null}
        </div>

        {ROWS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
          >
            <b className="text-[15px] font-semibold">{r.label}</b>
            <span className="ml-auto text-[19px] text-[#C0C4CC]">›</span>
          </Link>
        ))}

        <Link
          href={staff ? "/crew" : "/crew/login"}
          className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
        >
          <b className="text-[15px] font-semibold text-brand">
            크루로 전환하기
          </b>
          <span className="ml-auto text-[19px] text-[#C0C4CC]">›</span>
        </Link>

        {admin ? (
          <Link
            href="/admin"
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
          >
            <b className="text-[15px] font-semibold text-brand">운영 화면</b>
            <span className="ml-auto text-[19px] text-[#C0C4CC]">›</span>
          </Link>
        ) : null}

        {user ? (
          <LogoutButton
            to="/"
            confirm={
              user.is_anonymous
                ? "로그아웃하면 이 기기와 예매의 연결이 끊겨요.\n내 티켓은 예매번호와 연락처로 다시 찾을 수 있습니다.\n계속할까요?"
                : undefined
            }
            className="flex w-full items-center border-b border-line px-4 py-4 text-[15px] font-semibold text-sub"
          >
            로그아웃
          </LogoutButton>
        ) : null}

        <p className="px-4 py-6 text-[12.5px] leading-relaxed text-sub">
          파티모아는 티켓 금액의 7%를 수수료로 받습니다. 결제는 크루 계좌로
          직접 입금하는 방식이에요.
        </p>
      </div>
    </>
  );
}
