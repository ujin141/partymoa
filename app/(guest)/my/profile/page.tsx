import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/ProfileForm";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "프로필" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 익명 세션에 프로필을 붙이면 브라우저를 지우는 순간 같이 사라진다
  if (!user || user.is_anonymous) redirect("/login?next=/my/profile");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">프로필</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <ProfileForm
          profile={(data as Profile) ?? null}
          email={user.email ?? "이메일 없음"}
        />
      </div>
    </>
  );
}
