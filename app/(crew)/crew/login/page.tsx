import { redirect } from "next/navigation";

import { LoginForm } from "@/components/crew/LoginForm";
import { myCrew } from "@/lib/crew";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 로그인" };

export default async function CrewLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, crew] = await Promise.all([searchParams, myCrew()]);
  // 운영자만이고 크루는 아닌 사람도 있다. 그때는 next 를 따라간다
  if (crew) redirect(next ?? "/crew");

  return (
    <div className="flex-1 overflow-y-auto px-5 py-10">
      <h1 className="text-[24px] font-extrabold">크루 로그인</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-sub">
        파티를 여는 크루만 쓰는 화면이에요. 예매 현황·명단·입장·정산을 여기서
        봅니다. 스태프는 각자 구글 계정으로 들어오세요 — 비밀번호를 돌리면
        그게 그대로 손님 명단 접근 권한이 됩니다.
      </p>
      <div className="mt-6">
        <LoginForm next={next ?? "/crew"} />
      </div>
    </div>
  );
}
