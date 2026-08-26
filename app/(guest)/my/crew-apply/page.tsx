import Link from "next/link";
import { redirect } from "next/navigation";

import { CrewApplyForm } from "@/components/CrewApplyForm";
import { myCrews } from "@/lib/crew";
import { stamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CrewApplication } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 신청" };

/**
 * 크루 신청.
 *
 * 전에는 "크루로 전환하기" 가 크루 로그인으로 보냈다. 등록된 사람만
 * 들어가는 문이라 등록이 안 된 사람은 그냥 막혔고, 신청은 인스타 DM
 * 으로 받으라고 적어 뒀다. 그러면 무엇을 물어야 하는지 매번 다시 정하게
 * 된다. 받을 것을 화면으로 못 박는다.
 *
 * 이미 크루면 여기 있을 이유가 없다 — 바로 크루 화면으로 보낸다.
 */
export default async function CrewApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const crews = await myCrews();
  if (crews.length) redirect("/crew");

  const signedIn = Boolean(user && !user.is_anonymous);

  // **반드시 내 것만 고른다.** RLS 는 운영자에게 전부 열어 주므로,
  // 조건 없이 최신 한 건을 집으면 운영자가 남의 신청을 자기 것으로 본다
  const { data: rows } = signedIn
    ? await supabase
        .from("crew_applications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
    : { data: null };
  const last = (rows?.[0] ?? null) as CrewApplication | null;

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">크루 신청</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        {!signedIn ? (
          <>
            <h1 className="text-[21px] font-extrabold leading-snug">
              파티를 여시나요
            </h1>
            <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
              크루로 등록하면 예매를 받고, 명단·입금·입장·정산을 여기서
              봅니다. 신청하려면 먼저 로그인해 주세요 — 승인하면 그 계정으로
              크루 화면이 열립니다.
            </p>
            <Link
              href="/login?next=/my/crew-apply"
              className="mt-6 block rounded-xl bg-brand py-4 text-center text-base font-bold text-white"
            >
              로그인하고 신청하기
            </Link>
          </>
        ) : last?.status === "pending" ? (
          <div className="rounded-xl bg-soft px-4 py-5 text-[14px] leading-relaxed">
            <b className="block text-[15.5px]">심사 중이에요.</b>
            <span className="text-sub">
              {`${last.crew_name} · ${stamp(last.created_at)} 신청`}
            </span>
            <p className="mt-3 text-[13.5px] text-sub">
              {`확인하고 ${last.email} 로 알려 드릴게요. 보통 하루 안에 답합니다.`}
            </p>
          </div>
        ) : last?.status === "rejected" ? (
          <>
            <div className="mb-6 rounded-xl bg-[#FDECEF] px-4 py-4 text-[13.5px] leading-relaxed text-hot">
              <b className="block text-[15px]">지난 신청은 반려됐어요.</b>
              {last.reject_reason ?? "사유가 적혀 있지 않아요."}
            </div>
            <p className="mb-5 text-[14px] leading-relaxed text-sub">
              고쳐서 다시 넣을 수 있어요.
            </p>
            <CrewApplyForm defaultEmail={user?.email ?? ""} />
          </>
        ) : (
          <>
            <h1 className="text-[21px] font-extrabold leading-snug">
              파티를 여시나요
            </h1>
            <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
              크루로 등록하면 예매를 받고, 명단·입금·입장·정산을 한 화면에서
              봅니다. 수수료는 입금이 확인된 티켓에만 붙습니다.
            </p>
            <div className="mb-7 mt-5 rounded-xl bg-soft px-4 py-3.5 text-[13px] leading-7 text-sub">
              신청 → 확인 → 승인되면 이메일로 알려 드려요.
              <br />
              적어 주신 이메일로 로그인하면 크루 화면이 열립니다.
            </div>
            <CrewApplyForm defaultEmail={user?.email ?? ""} />
          </>
        )}
      </div>
    </>
  );
}
