import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import { Symbol } from "@/components/Symbol";
import { isAdmin } from "@/lib/admin";
import { FEE_RATE } from "@/lib/rules";
import { myCrews } from "@/lib/crew";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "마이" };

/**
 * 두 덩어리로 나눈다.
 *
 * 여덟 줄이 똑같은 굵기로 늘어서 있으면 찾는 데 시간이 걸린다. 자주
 * 누르는 것(내 것)과 가끔 읽는 것(안내)은 성격이 다르다.
 *
 * **계정 삭제는 여기 안 넣는다.** 되돌릴 수 없는 것이 약관 링크와 같은
 * 모양으로 나란히 있으면 안 된다. 맨 아래에 따로, 작게 둔다.
 */
const MINE = [
  { label: "프로필 편집", href: "/my/profile" },
  { label: "찜한 파티", href: "/my/favorites" },
  { label: "팔로우한 크루", href: "/my/crews" },
  { label: "알림 설정", href: "/my/alerts" },
];

const INFO = [
  { label: "고객센터", href: "/my/help" },
  { label: "이용약관", href: "/terms" },
  { label: "개인정보처리방침", href: "/privacy" },
];

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 익명 세션은 "로그인" 으로 치지 않는다. 기기에 묶여 있을 뿐이다
  const signedIn = Boolean(user && !user.is_anonymous);

  // **여기서 다시 판정하지 않는다.** 예전에는 app_admins 와 crew_members 를
  // uuid 로만 조회했는데, 구글로 로그인하면 새 uuid 가 생겨서 권한이 이메일
  // 쪽에만 있다. 그래서 운영자인데 운영 화면 줄이 안 떴다.
  // 판정은 lib/admin · lib/crew 한 군데서만 한다
  const [crews, adminUser, { data: profile }] = await Promise.all([
    myCrews(),
    isAdmin(),
    // 이메일을 그대로 띄우면 남한테 보여 줄 이름이 없다
    user && !user.is_anonymous
      ? supabase
          .from("profiles")
          .select("nickname")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const staff = crews.length > 0;
  const admin = Boolean(adminUser);

  // 신청해 놓고 기다리는 사람에게 "크루 신청하기" 를 다시 띄우면 또
  // 낸다. 심사 중인지 아닌지를 줄에 그대로 적는다
  const { data: appRow } = signedIn && !staff
    ? await supabase
        .from("crew_applications")
        .select("status")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const waiting =
    (appRow as { status: string } | null)?.status === "pending";

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
                {signedIn
                  ? ((profile as { nickname: string | null } | null)?.nickname ??
                    user?.email ??
                    "회원")
                  : "게스트"}
              </b>
              <p className="mt-0.5 truncate text-[13px] text-sub">
                {signedIn
                  ? (user?.email ?? "로그인됨")
                  : "로그인 없이 예매하고 있어요"}
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

        {MINE.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
          >
            <b className="text-[15px] font-semibold">{r.label}</b>
            <span className="ml-auto text-[19px] text-[#C0C4CC]">›</span>
          </Link>
        ))}

        <div className="h-2 bg-soft" />

        {INFO.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
          >
            <b className="text-[15px] font-semibold">{r.label}</b>
            <span className="ml-auto text-[19px] text-[#C0C4CC]">›</span>
          </Link>
        ))}

        {/* 크루면 바로 관리 화면, 아니면 신청부터. 예전에는 크루 로그인으로
            보냈는데 등록된 사람만 들어가는 문이라 그냥 막혔다 */}
        <Link
          href={staff ? "/crew" : "/my/crew-apply"}
          className="flex w-full items-center gap-3 border-b border-line px-4 py-4"
        >
          <b
            className={`text-[15px] font-semibold ${
              waiting ? "text-sub" : "text-brand"
            }`}
          >
            {staff ? "크루로 전환하기" : waiting ? "크루 신청 심사 중" : "크루 신청하기"}
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

        {/* 숫자를 다시 적지 않는다. 예전에 7% 로 적어 두고 요율만 올려서
            화면과 실제가 어긋나 있었다 */}
        <p className="px-4 pb-4 pt-6 text-[12.5px] leading-relaxed text-sub">
          {`파티모아는 티켓 금액의 ${Math.round(FEE_RATE * 100)}%를 수수료로 받습니다. 결제는 크루 계좌로 직접 입금하는 방식이에요.`}
        </p>

        {/* 되돌릴 수 없는 것은 눈에 덜 띄게. 찾는 사람은 어차피 찾는다 */}
        <Link
          href="/delete"
          className="block px-4 pb-8 text-[12.5px] text-[#A6ABB5] underline"
        >
          계정 삭제
        </Link>
      </div>
    </>
  );
}
