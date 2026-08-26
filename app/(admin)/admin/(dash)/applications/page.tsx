import { ApplicationCard } from "@/components/admin/ApplicationCard";
import { createClient } from "@/lib/supabase/server";
import type { CrewApplication } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 신청", robots: { index: false } };

export default async function AdminApplicationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crew_applications")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as CrewApplication[];

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-4 pt-5">
        <h1 className="text-[21px] font-extrabold">크루 신청</h1>
        <p className="mt-1 text-[13px] text-sub">
          {`심사 중 ${pending.length}건 · 전체 ${rows.length}건`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm leading-7 text-sub">
          아직 들어온 신청이 없어요.
          <br />
          신청은 마이 → 크루로 전환하기 에서 받습니다.
        </p>
      ) : null}

      {pending.map((a) => (
        <ApplicationCard key={a.id} app={a} />
      ))}

      {done.length ? (
        <>
          <div className="border-b border-line bg-soft px-4 py-2 text-[12.5px] font-semibold text-sub">
            처리한 신청
          </div>
          {done.map((a) => (
            <ApplicationCard key={a.id} app={a} />
          ))}
        </>
      ) : null}
      <div className="h-8" />
    </div>
  );
}
