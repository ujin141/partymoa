import Link from "next/link";

import { Symbol } from "@/components/Symbol";

export default function NotFound() {
  return (
    <div className="mx-auto grid h-dvh max-w-[430px] place-items-center bg-white px-6 text-center">
      <div>
        <Symbol size={48} className="mx-auto opacity-30" />
        <h1 className="mt-5 text-[20px] font-extrabold">
          없는 페이지예요
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
          주소가 바뀌었거나 파티가 내려갔을 수 있어요.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand px-6 py-3.5 text-[15px] font-bold text-white"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
