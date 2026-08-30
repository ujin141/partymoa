import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/components/crew/EventForm";
import { myCrew } from "@/lib/crew";
import { createClient } from "@/lib/supabase/server";
import type {
  EventPerk,
  EventPhoto,
  EventRow,
  EventTable,
  Lineup,
  TicketTier,
} from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "파티 수정" };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const crew = await myCrew();
  if (!crew) redirect("/crew/login");

  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: event },
    { data: tiers },
    { data: lineups },
    { data: tables },
    { data: photos },
    { data: perks },
  ] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("ticket_tiers")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
      supabase.from("lineups").select("*").eq("event_id", id).order("sort_order"),
      supabase
        .from("event_tables")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
      supabase
        .from("event_photos")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
      supabase
        .from("event_perks")
        .select("*")
        .eq("event_id", id)
        .order("sort_order"),
    ]);

  // RLS 가 이미 막지만, 남의 행사 주소를 직접 쳤을 때 빈 폼이 뜨는 걸 막는다
  if (!event || (event as EventRow).crew_id !== crew.id) notFound();

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Link
          href="/crew/manage"
          className="text-2xl leading-none"
          aria-label="뒤로"
        >
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">파티 수정</span>
      </div>
      <EventForm
        initial={{
          event: event as EventRow,
          tiers: (tiers ?? []) as TicketTier[],
          lineups: (lineups ?? []) as Lineup[],
          tables: (tables ?? []) as EventTable[],
          photos: (photos ?? []) as EventPhoto[],
          perks: (perks ?? []) as EventPerk[],
        }}
      />
    </div>
  );
}
