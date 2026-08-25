import Link from "next/link";
import { redirect } from "next/navigation";

import { CrewProfileForm } from "@/components/crew/CrewProfileForm";
import { EventAdminList } from "@/components/crew/EventAdminList";
import { MemberManager } from "@/components/crew/MemberManager";
import { Divider } from "@/components/ui/primitives";
import { crewEvents, myCrew } from "@/lib/crew";
import { createClient } from "@/lib/supabase/server";
import type { Booking, CrewMember } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 관리" };

export default async function CrewManagePage() {
  const crew = await myCrew();
  if (!crew) redirect("/crew/login");

  const supabase = await createClient();
  const [events, { data: members }, { data: bookings }] = await Promise.all([
    crewEvents(crew.id),
    supabase.from("crew_members").select("*").eq("crew_id", crew.id),
    supabase
      .from("bookings")
      .select("invite_code, quantity, amount, status, event_id")
      .neq("status", "cancelled"),
  ]);

  // 코드별 집계. 크루의 모든 행사를 합친다 — 관리 화면은 누적이 맞다
  const eventIds = new Set(events.map((e) => e.id));
  const stats: Record<string, { heads: number; revenue: number }> = {};
  for (const b of (bookings ?? []) as Pick<
    Booking,
    "invite_code" | "quantity" | "amount" | "event_id"
  >[]) {
    if (!b.invite_code || !eventIds.has(b.event_id)) continue;
    const s = (stats[b.invite_code] ??= { heads: 0, revenue: 0 });
    s.heads += b.quantity;
    s.revenue += b.amount;
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/crew" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">크루 관리</span>
      </div>

      <CrewProfileForm crew={crew} />

      <Divider />
      <MemberManager members={(members ?? []) as CrewMember[]} stats={stats} />

      <Divider />
      <EventAdminList events={events} />

      <div className="h-6" />
    </div>
  );
}
