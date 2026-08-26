import "server-only";

import { unstable_cache } from "next/cache";

import { currentUser } from "@/lib/session";
import { publicClient } from "@/lib/supabase/public";

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
  crew: Pick<Crew, "id" | "name" | "slug" | "avatar_url" | "instagram">;
  stats: EventStats;
  /** 지금 팔리는 차수. 전부 소진이면 null */
  tier: TicketTier | null;
  /** 이 사람이 찜했는지. 로그인 전에는 늘 false */
  favorited: boolean;
}

const EVENT_SELECT = `
  *,
  crew:crews!inner (id, name, slug, avatar_url, instagram),
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
  // 로그인·익명 세션이 없으면 찜도 없다. 물어볼 이유가 없다
  const user = await currentUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("event_id")
    .eq("user_id", user.id)
    .in("event_id", eventIds);
  return new Set((data ?? []).map((f) => f.event_id));
}

/**
 * 열려 있는 파티 — **누가 보든 같은 부분만.** 찜은 여기 안 들어간다.
 *
 * 트래픽이 몰릴 때 이게 제일 크다. 요청마다 이벤트·크루·차수·집계 네
 * 벌을 읽었는데, 그 값은 모든 방문자에게 똑같다. 20초만 들고 있어도
 * DB 호출이 수십 분의 일로 준다.
 *
 * 20초인 이유는 잔여 자리 때문이다. 마감 직전에 몇 초 늦게 보이는 건
 * 감수하되(서버가 예매 시점에 다시 세므로 초과 예매는 안 난다), 분
 * 단위로 늦으면 매진된 파티가 계속 열려 보인다.
 *
 * 예매·취소·입금 확인이 일어나면 태그로 즉시 무효화한다.
 */
export const PARTY_TAG = "parties";

const publicParties = unstable_cache(
  async () => {
    const supabase = publicClient();
    const { data } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("status", "open")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    const rows = (data ?? []) as unknown as RawEvent[];
    if (!rows.length) return { rows, statMap: [], soldMap: [] };

    const ids = rows.map((r) => r.id);
    const [{ data: stats }, { data: tierStats }] = await Promise.all([
      supabase.from("event_stats").select("*").in("event_id", ids),
      supabase.from("tier_stats").select("*").in("event_id", ids),
    ]);
    return {
      rows,
      statMap: (stats ?? []).map((x: EventStats) => [x.event_id, x] as const),
      soldMap: (tierStats ?? []).map((t: TierStats) => [t.tier_id, t.sold] as const),
    };
  },
  ["open-parties"],
  { revalidate: 20, tags: [PARTY_TAG] },
);

/** 열려 있는 파티에 실제로 있는 지역만. 없는 지역을 칩으로 두면 빈 화면이 된다 */
export async function listAreas(): Promise<string[]> {
  const { rows } = await publicParties();
  return [...new Set(rows.map((e) => e.area).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

/** 찜한 파티만 */
export async function listFavorites(): Promise<PartyCardData[]> {
  const user = await currentUser();
  if (!user) return [];
  const supabase = await createClient();

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

/**
 * 열려 있고 아직 안 지난 파티. 홈·둘러보기가 전부 이걸 쓴다.
 *
 * 공개 부분은 캐시에서 꺼내고, 찜만 이 사람 것으로 얹는다.
 */
export async function listOpenParties(): Promise<PartyCardData[]> {
  const { rows, statMap, soldMap } = await publicParties();
  if (!rows.length) return [];

  const stats = new Map(statMap);
  const sold = new Map(soldMap);
  const favs = await favoriteIds(rows.map((r) => r.id));

  return rows.map(({ crew, tiers, ...event }) => ({
    event,
    crew,
    stats: stats.get(event.id) ?? emptyStats(event),
    tier: currentTier(tiers ?? [], sold),
    favorited: favs.has(event.id),
  }));
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
  const user = await currentUser();
  if (!user) return [];
  const supabase = await createClient();

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

/** 크루 목록. 하루에 몇 번 바뀌지도 않는데 요청마다 읽을 이유가 없다 */
export const listCrews = unstable_cache(
  async (): Promise<Crew[]> => {
    const { data } = await publicClient()
      .from("crews")
      .select("*")
      .order("created_at", { ascending: true });
    return (data ?? []) as Crew[];
  },
  ["crews"],
  { revalidate: 300, tags: [PARTY_TAG] },
);
