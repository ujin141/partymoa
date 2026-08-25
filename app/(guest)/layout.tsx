import { GuestTabs } from "@/components/GuestTabs";
import { EnsureSession } from "@/components/EnsureSession";

/**
 * 게스트 앱 셸. 폰 폭(430px)을 넘지 않는다 — 사양서 4절.
 * 데스크톱에서도 가운데 폰 한 대처럼 보이는 것이 의도다.
 */
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] sm:border-x sm:border-line">
      <EnsureSession />
      {children}
      <GuestTabs />
    </div>
  );
}
