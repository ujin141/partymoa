import Link from "next/link";

export const metadata = { title: "알림 설정" };

export default function AlertsPage() {
  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">알림 설정</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="rounded-xl bg-soft p-4 text-[13.5px] leading-7 text-sub">
          아직 앱 푸시가 없어요. 지금은 예매·입금 안내를 예매번호로 확인하는
          방식입니다.
          <br />
          <br />
          마감 임박이나 새 파티 알림은 다음에 붙일 예정이에요.
        </div>
        <Link
          href="/explore"
          className="mt-4 block rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold"
        >
          파티 둘러보기
        </Link>
      </div>
    </>
  );
}
