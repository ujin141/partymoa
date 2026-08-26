import Link from "next/link";
import { redirect } from "next/navigation";

import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { LoginForm } from "@/components/crew/LoginForm";
import { PasswordLogin } from "@/components/PasswordLogin";
import { myCrew } from "@/lib/crew";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 로그인" };

export default async function CrewLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, crew] = await Promise.all([searchParams, myCrew()]);
  if (crew) redirect(next ?? "/crew");

  return (
    <div className="flex-1 overflow-y-auto px-5 py-10">
      <h1 className="text-[24px] font-extrabold">크루 로그인</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-sub">
        파티를 여는 크루만 쓰는 화면이에요. 예매 현황·명단·입장·정산을 여기서
        봅니다. 스태프는 각자 구글 계정으로 들어오세요 — 비밀번호를 돌리면
        그게 그대로 손님 명단 접근 권한이 됩니다.
      </p>
      <p className="mt-2 text-[13px] text-sub">
        파티모아를 운영하는 사람은{" "}
        <Link href="/admin/login" className="underline">
          운영자 로그인
        </Link>{" "}
        으로 가세요. 크루 화면과 권한이 다릅니다.
      </p>
      {error ? (
        <p className="mt-4 rounded-xl bg-[#FDECEF] px-4 py-3.5 text-[13.5px] leading-relaxed text-hot">
          로그인이 안 됐어요 — {error}
        </p>
      ) : null}
      <InAppBrowserNotice />
      <div className="mt-6">
        <LoginForm next={next ?? "/crew"} />
        <PasswordLogin next={next ?? "/crew"} />
      </div>
    </div>
  );
}
