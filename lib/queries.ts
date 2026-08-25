import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Booking,
  Crew,
  EventRow,
  EventStats,
  Lineup,
  TicketTier,
  TierStats,
} from "@/types/database";

/** 목록·상세에서 같이 쓰는 묶음. 화면마다 다른 모양을 만들지 않는다 */
export interface PartyCardData {
  event: EventRow;
  crew: Pick<Crew, "id" | "name" | "slug" | "avatar_url">;
  stats: EventStats;
  /** 지금 팔리는 차수. 전부 소진이면 null */
  tier: TicketTier | null;
  /** 이 사람이 찜했는지. 로그인 전에는 늘 false */
  favorited: boolean;
}

const EVENT_SELECT = `
  *,
  crew:crews!inner (id, name, slug, avatar_url),
  tiers:ticket_tiers (*)
`;

interface RawEvent extends EventRow {
  crew: PartyCardData["crew"];
  tiers: TicketTier[];
}

function emptyStats(e: EventRow): EventStats {
  return {
    event_id: e.id,
    capacity: e.capacity,
    booked: 0,
    booked_f: 0,
    booked_m: 0,
    revenue_paid: 0,
    revenue_total: 0,
  };
}

/**
 * 지금 팔리는 차수를 고른다. 얼리버드가 소진되면 자동으로 다음 차수다
 * (사양서 3-2). 판매량은 tier_stats 에서 온다 — 앱이 세지 않는다.
 */
export function currentTier(
  tiers: TicketTier[],
  sold: Map<string, number>,
): TicketTier | null {
  return (
    [...tiers]
      .sort((a, b) => a.sort_order - b.sort_order)
      .find((t) => (sold.get(t.id) ?? 0) < t.capacity) ?? null
  );
}

async function decorate(rows: RawEvent[]): Promise<PartyCardData[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);

  const [{ data: stats }, { data: tierStats }] = await Promise.all([
    supabase.from("event_stats").select("*").in("event_id", ids),
    supabase.from("tier_stats").select("*").in("event_id", ids),
  ]);

  const statMap = new Map((stats ?? []).map((s: EventStats) => [s.event_id, s]));
  const soldMap = new Map(
    (tierStats ?? []).map((t: TierStats) => [t.tier_id, t.sold]),
  );
  const favs = await favoriteIds(ids);

  return rows.map(({ crew, tiers, ...event }) => ({
    event,
    crew,
    stats: statMap.get(event.id) ?? emptyStats(event),
    tier: currentTier(tiers ?? [], soldMap),
    favorited: favs.has(event.id),
  }));
}

/** 지금 사람이 찜해 둔 파티 id. 로그인 안 했으면 빈 집합 */
async function favoriteIds(eventIds: string[]): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("favorites")
    .select("event_id")
    .eq("user_id", user.id)
    .in("event_id", eventIds);
  return new Set((data ?? []).map((f) => f.event_id));
}

/** 열려 있는 파티에 실제로 있는 지역만. 없는 지역을 칩으로 두면 빈 화면이 된다 */
export async function listAreas(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("area")
    .eq("status", "open")
    .gte("ends_at", new Date().toISOString());
  return [...new Set((data ?? []).map((e) => e.area).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
}

/** 찜한 파티만 */
export async function listFavorites(): Promise<PartyCardData[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: favs } = await supabase
    .from("favorites")
    .select("event_id")
    .eq("user_id", user.id);
  const ids = (favs ?? []).map((f) => f.event_id);
  if (!ids.length) return [];

  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .in("id", ids)
    .order("starts_at", { ascending: true });
  return decorate((data ?? []) as unknown as RawEvent[]);
}

/** 열려 있고 아직 안 지난 파티. 홈·둘러보기가 전부 이걸 쓴다 */
export async function listOpenParties(): Promise<PartyCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "open")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return decorate((data ?? []) as unknown as RawEvent[]);
}

export interface PartyDetail extends PartyCardData {
  tiers: TicketTier[];
  lineups: Lineup[];
  tierSold: Record<string, number>;
}

export async function getParty(slug: string): Promise<PartyDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(`${EVENT_SELECT}, lineups (*)`)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;

  const raw = data as unknown as RawEvent & { lineups: Lineup[] };
  const [{ data: stats }, { data: tierStats }] = await Promise.all([
    supabase
      .from("event_stats")
      .select("*")
      .eq("event_id", raw.id)
      .maybeSingle(),
    supabase.from("tier_stats").select("*").eq("event_id", raw.id),
  ]);

  const sold = new Map(
    (tierStats ?? []).map((t: TierStats) => [t.tier_id, t.sold]),
  );
  const tiers = [...(raw.tiers ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const { crew, lineups, ...event } = raw;

  return {
    event,
    crew,
    favorited: (await favoriteIds([raw.id])).has(raw.id),
    tiers,
    lineups: [...(lineups ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    tierSold: Object.fromEntries(sold),
    stats: (stats as EventStats) ?? emptyStats(event),
    tier: currentTier(tiers, sold),
  };
}

/** 내 티켓. 익명 로그인 사용자도 자기 예매는 RLS 로 읽힌다 */
export async function myBookings(): Promise<
  (Booking & { event: EventRow; tier: TicketTier })[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("bookings")
    .select("*, event:events (*), tier:ticket_tiers (*)")
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as (Booking & {
    event: EventRow;
    tier: TicketTier;
  })[];
}

export async function listCrews(): Promise<Crew[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crews")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as Crew[];
}
