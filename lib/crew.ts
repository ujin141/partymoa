import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Booking,
  Crew,
  CrewMember,
  EventRow,
  EventStats,
  TicketTier,
  TierStats,
} from "@/types/database";

/** 로그인한 사람이 속한 크루. 여러 개면 첫 번째 */
export async function myCrew(): Promise<Crew | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;

  const { data: owned } = await supabase
    .from("crews")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1);
  if (owned?.length) return owned[0] as Crew;

  const { data: mem } = await supabase
    .from("crew_members")
    .select("crew:crews (*)")
    .eq("user_id", user.id)
    .limit(1);
  const row = mem?.[0] as unknown as { crew: Crew } | undefined;
  return row?.crew ?? null;
}

export async function crewEvents(crewId: string): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("crew_id", crewId)
    .order("starts_at", { ascending: false });
  return (data ?? []) as EventRow[];
}

export interface AdminEvent {
  event: EventRow;
  stats: EventStats;
  tiers: (TicketTier & { sold: number })[];
  bookings: Booking[];
  members: CrewMember[];
}

/**
 * 관리자 화면 한 벌. 명단이 몇백 건이라 한 번에 다 읽고 화면에서 거른다 —
 * 현장에서는 검색을 칠 때마다 왕복하는 것보다 이게 빠르다.
 */
export async function adminEvent(eventId: string): Promise<AdminEvent | null> {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const [{ data: stats }, { data: tiers }, { data: tierStats }, { data: bookings }, { data: members }] =
    await Promise.all([
      supabase.from("event_stats").select("*").eq("event_id", eventId).maybeSingle(),
      supabase.from("ticket_tiers").select("*").eq("event_id", eventId).order("sort_order"),
      supabase.from("tier_stats").select("*").eq("event_id", eventId),
      supabase
        .from("bookings")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
      supabase.from("crew_members").select("*").eq("crew_id", (event as EventRow).crew_id),
    ]);

  const sold = new Map(
    ((tierStats ?? []) as TierStats[]).map((t) => [t.tier_id, t.sold]),
  );

  return {
    event: event as EventRow,
    stats: (stats as EventStats) ?? {
      event_id: eventId,
      capacity: (event as EventRow).capacity,
      booked: 0,
      booked_f: 0,
      booked_m: 0,
      revenue_paid: 0,
      revenue_total: 0,
    },
    tiers: ((tiers ?? []) as TicketTier[]).map((t) => ({
      ...t,
      sold: sold.get(t.id) ?? 0,
    })),
    bookings: (bookings ?? []) as Booking[],
    members: (members ?? []) as CrewMember[],
  };
}

/** 취소가 아닌 예매만 센다 — 화면 숫자는 전부 이걸 거친다 */
export const live = (rows: Booking[]) =>
  rows.filter((b) => b.status !== "cancelled");

export const heads = (rows: Booking[]) =>
  rows.reduce((a, b) => a + b.quantity, 0);

export const money = (rows: Booking[]) =>
  rows.reduce((a, b) => a + b.amount, 0);
