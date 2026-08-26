import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Booking,
  Crew,
  CrewMember,
  EventRow,
  EventStats,
  EventTable,
  TicketTier,
  TierStats,
} from "@/types/database";

/**
 * 로그인한 사람이 속한 크루를 **전부** 가져온다.
 *
 * 한 사람이 크루 여럿에 속할 수 있다 — DJ 가 두 크루에서 뛰거나, 대행을
 * 맡는 경우다. 예전에는 첫 번째 하나만 집어 와서 나머지가 아예 안 보였다.
 *
 * 세 갈래로 찾는다. **이메일까지 보는 게 중요하다** — 구글로 로그인하면
 * 이메일/비밀번호 계정과 uuid 가 달라서 uuid 로만 보면 남이 된다.
 */
export async function myCrews(): Promise<Crew[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return [];

  const [{ data: owned }, { data: byId }, { data: byMail }] = await Promise.all([
    supabase.from("crews").select("*").eq("owner_id", user.id),
    supabase.from("crew_members").select("crew:crews (*)").eq("user_id", user.id),
    user.email
      ? supabase.from("crew_members").select("crew:crews (*)").ilike("email", user.email)
      : Promise.resolve({ data: [] }),
  ]);

  const seen = new Map<string, Crew>();
  for (const c of (owned ?? []) as Crew[]) seen.set(c.id, c);
  for (const row of [...(byId ?? []), ...(byMail ?? [])] as unknown as {
    crew: Crew | null;
  }[]) {
    if (row.crew) seen.set(row.crew.id, row.crew);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/** 하나만 필요할 때. 고른 크루가 있으면 그것, 없으면 첫 번째 */
export async function myCrew(preferId?: string): Promise<Crew | null> {
  const list = await myCrews();
  if (!list.length) return null;
  return list.find((c) => c.id === preferId) ?? list[0];
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
  /** 테이블 메뉴. 명단에서 예매를 이름으로 바꿔 보여주는 데 쓴다 */
  tables: EventTable[];
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

  const [
    { data: stats },
    { data: tiers },
    { data: tierStats },
    { data: bookings },
    { data: members },
    { data: tables },
  ] = await Promise.all([
      supabase.from("event_stats").select("*").eq("event_id", eventId).maybeSingle(),
      supabase.from("ticket_tiers").select("*").eq("event_id", eventId).order("sort_order"),
      supabase.from("tier_stats").select("*").eq("event_id", eventId),
      supabase
        .from("bookings")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
      supabase.from("crew_members").select("*").eq("crew_id", (event as EventRow).crew_id),
      supabase
        .from("event_tables")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
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
    tables: (tables ?? []) as EventTable[],
  };
}

/** 취소가 아닌 예매만 센다 — 화면 숫자는 전부 이걸 거친다 */
export const live = (rows: Booking[]) =>
  rows.filter((b) => b.status !== "cancelled");

export const heads = (rows: Booking[]) =>
  rows.reduce((a, b) => a + b.quantity, 0);

export const money = (rows: Booking[]) =>
  rows.reduce((a, b) => a + b.amount, 0);
