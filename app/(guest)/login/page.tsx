import Link from "next/link";
import { redirect } from "next/navigation";

import { SocialLogin } from "@/components/SocialLogin";
import { Symbol } from "@/components/Symbol";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 이미 제대로 로그인했으면 여기 있을 이유가 없다
  if (user && !user.is_anonymous) redirect(next ?? "/my");

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">로그인</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="mb-7 text-center">
          <Symbol size={44} className="mx-auto" />
          <h1 className="mt-4 text-[21px] font-extrabold leading-snug">
            로그인 안 해도 예매는 됩니다
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
            로그인하면 기기를 바꿔도 티켓이 따라오고,
            <br />
            찜과 커뮤니티 글이 계정에 남아요.
          </p>
        </div>

        <SocialLogin next={next ?? "/my"} />

        <Link
          href="/"
          className="mt-3 block rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold text-sub"
        >
          그냥 둘러보기
        </Link>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-sub">
          로그인하면{" "}
          <Link href="/terms" className="underline">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
          에 동의하는 것으로 봅니다.
        </p>

        <div className="mt-8 border-t border-line pt-5 text-center">
          <Link href="/crew/login" className="text-[13px] text-sub underline">
            파티를 여는 크루라면 여기로
          </Link>
        </div>
      </div>
    </>
  );
}
