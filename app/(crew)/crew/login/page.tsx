import { redirect } from "next/navigation";

import { LoginForm } from "@/components/crew/LoginForm";
import { myCrew } from "@/lib/crew";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 로그인" };

export default async function CrewLoginPage() {
  const crew = await myCrew();
  if (crew) redirect("/crew");

  return (
    <div className="flex-1 overflow-y-auto px-5 py-10">
      <h1 className="text-[24px] font-extrabold">크루 로그인</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-sub">
        파티를 여는 크루만 쓰는 화면이에요. 예매 현황·명단·입장·정산을 여기서
        봅니다.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
