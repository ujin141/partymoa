import { DesktopInstall } from "@/components/DesktopInstall";
import { EnsureSession } from "@/components/EnsureSession";
import { GuestTabs } from "@/components/GuestTabs";
import { OnboardingGate } from "@/components/OnboardingGate";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * 게스트 앱 셸. 폰 폭(430px)을 넘지 않는다 — 사양서 4절.
 * 데스크톱에서도 가운데 폰 한 대처럼 보이는 것이 의도다.
 *
 * 시작 화면은 이 안에 절대 배치로 얹는다. 셸 밖에 두면 데스크톱에서
 * 화면 전체를 덮어 폰 모양이 깨진다.
 */
export default async function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user && !user.is_anonymous);

  const { data } = signedIn
    ? await supabase
        .from("profiles")
        .select("areas, categories, onboarded_at")
        .eq("user_id", user!.id)
        .maybeSingle()
    : { data: null };
  const p = data as Pick<
    Profile,
    "areas" | "categories" | "onboarded_at"
  > | null;

  return (
    <div className="relative mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] sm:border-x sm:border-line">
      <EnsureSession />
      {/* PC 로 들어온 사람을 폰으로 옮긴다. 셸 밖(고정 위치)이라 폰
          모양을 안 건드린다 */}
      <DesktopInstall />
      <OnboardingGate
        signedIn={signedIn}
        onboarded={Boolean(p?.onboarded_at)}
        areas={p?.areas ?? []}
        categories={p?.categories ?? []}
      />
      {children}
      <GuestTabs />
    </div>
  );
}
