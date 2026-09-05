import "server-only";

import { unstable_cache } from "next/cache";

import { currentUser } from "@/lib/session";
import { publicClient } from "@/lib/supabase/public";

import { createClient } from "@/lib/supabase/server";
import type {
  Booking,
  BookingPerk,
  Crew,
  EventPerk,
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
 *
 * **정원만 보면 안 된다.** 끝난 차수에서 한 건이 취소되면 자리가 한 칸
 * 생기고, 그 순간 그 차수가 다시 "지금 파는 차수" 가 된다. 홈 카드의
 * 가격이 옛 가격으로 돌아가고 할인 표시까지 붙는다 — 실제로 났던 일이다.
 * 크루가 닫은 차수는 자리가 남아도 건너뛴다.
 */
export function tierClosed(t: TicketTier, sold: Map<string, number>) {
  return Boolean(t.closed_at) || (sold.get(t.id) ?? 0) >= t.capacity;
}

export function currentTier(
  tiers: TicketTier[],
  sold: Map<string, number>,
): TicketTier | null {
  return (
    [...tiers]
      .sort((a, b) => a.sort_order - b.sort_order)
      .find((t) => !tierClosed(t, sold)) ?? null
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

/**
 * 홈에 얹을 것들. **한 번에 가져와서 캐시에 둔다.**
 *
 * 파티 카드만 늘어놓으면 파티가 하나일 때 화면이 카드 한 장으로 끝난다.
 * 그런데 이 앱에는 카드 말고도 보여 줄 게 있다 — 누가 트는지(라인업),
 * 어떤 분위기인지(현장 사진). 클럽 씬에서 그 둘이 실제 구매 이유다.
 *
 * 공개 정보만 담는다. 그래서 쿠키 없는 클라이언트로 읽고 캐시에 둔다 —
 * 사람마다 다른 게 없으니 방문자마다 왕복할 이유가 없다.
 */
export const homeExtras = unstable_cache(
  async () => {
    const supabase = publicClient();
    const { data: open } = await supabase
      .from("events")
      .select("id, slug, title")
      .eq("status", "open")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10);

    const events = (open ?? []) as Pick<EventRow, "id" | "slug" | "title">[];

    /**
     * **끝난 파티 사진으로 채운다.**
     *
     * 예전에는 열린 파티가 없으면 여기서 빈손으로 돌아갔다. 그런데
     * 파티가 매주 열리는 게 아니라서, 파티 사이 기간에는 홈에 사진이
     * 한 장도 없었다 — 처음 온 사람이 "여기가 뭐 하는 데지" 를 판단할
     * 재료가 사라진다. 지난 파티 사진이 그 자리를 대신한다.
     */
    const { data: over } = await supabase
      .from("events")
      .select("id, slug, title")
      .eq("status", "done")
      .order("starts_at", { ascending: false })
      .limit(4);
    const past = (over ?? []) as Pick<EventRow, "id" | "slug" | "title">[];
    const all = [...events, ...past];
    if (!all.length) return { djs: [], photos: [], perks: [] };

    const ids = all.map((e) => e.id);
    const bySlug = new Map(all.map((e) => [e.id, e]));

    const [{ data: lines }, { data: pics }, { data: perkRows }] = await Promise.all([
      // 라인업은 **파는 파티 것만.** 지난 디제이를 홈에 세우면 오늘
      // 오는 사람인 줄 안다
      supabase
        .from("lineups")
        .select("id, event_id, artist_name, starts_at, sort_order")
        .in("event_id", events.length ? events.map((e) => e.id) : ["-"])
        .order("sort_order", { ascending: true }),
      supabase
        .from("event_photos")
        .select("id, event_id, url, caption, sort_order")
        .in("event_id", ids)
        .order("sort_order", { ascending: true })
        .limit(24),
      // 예매에 딸려 오는 것. 웰컴샷 같은 것 — 홈에서 파티 하나를 크게
      // 보여 줄 때 값 옆에 같이 선다
      supabase
        .from("event_perks")
        .select("event_id, name, qty, sort_order")
        .in("event_id", events.length ? events.map((e) => e.id) : ["-"])
        .order("sort_order", { ascending: true }),
    ]);

    /**
     * **같은 이름은 한 번만.** 백투백(HEIDY x CHIPS)이 있으면 같은
     * 사람이 두세 번 나온다. 라인업 표에서는 그게 맞지만 홈에서는
     * 그냥 같은 이름이 반복되는 것으로 보인다.
     */
    const seen = new Set<string>();
    const djs: { id: string; name: string; slug: string; time: string | null }[] = [];
    for (const l of (lines ?? []) as Lineup[]) {
      // **양옆에 공백이 있을 때만 자른다.** `[x]` 만 보면 XANTHIC 이
      // 'ANTHIC' 이 된다. 백투백은 늘 'HEIDY x CHIPS' 처럼 띄어 쓴다
      for (const name of l.artist_name.split(/\s+[x×]\s+/i)) {
        const key = name.trim().toUpperCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        djs.push({
          id: l.id + key,
          name: name.trim(),
          slug: bySlug.get(l.event_id)?.slug ?? "",
          // 몇 시에 트는지. 홈에서 이름만 세우면 순서가 안 보인다.
          // **lineups.starts_at 은 time 컬럼이다** — '22:00:00' 으로 온다.
          // Date 로 읽으면 Invalid Date 가 된다. 앞 다섯 글자면 된다
          time: l.starts_at ? l.starts_at.slice(0, 5) : null,
        });
      }
    }

    const perks = ((perkRows ?? []) as {
      event_id: string;
      name: string;
      qty: number;
    }[]).map((p) => ({
      slug: bySlug.get(p.event_id)?.slug ?? "",
      name: p.name,
      qty: p.qty,
    }));

    /**
     * **파는 파티 사진이 먼저다.** 지난 파티 사진은 빈자리를 메우는
     * 용도지, 오늘 파는 판을 밀어내라고 넣은 게 아니다.
     */
    const openIds = new Set(events.map((e) => e.id));
    const photos = ((pics ?? []) as {
      id: string;
      event_id: string;
      url: string;
      caption: string | null;
    }[])
      .map((x) => ({
        id: x.id,
        url: x.url,
        caption: x.caption,
        slug: bySlug.get(x.event_id)?.slug ?? "",
        live: openIds.has(x.event_id),
      }))
      .sort((a, b) => Number(b.live) - Number(a.live))
      .slice(0, 16)
      .map(({ live: _live, ...rest }) => rest);

    return { djs: djs.slice(0, 20), photos, perks };
  },
  ["home-extras"],
  { revalidate: 120, tags: [PARTY_TAG] },
);

/**
 * 지금까지의 합계. **파티 사이 기간에 홈이 내놓을 유일한 증거다.**
 *
 * 팔 게 없을 때 "아직 열린 파티가 없어요" 만 띄우면 처음 온 사람은
 * 그냥 나간다. 몇 번 열었고 몇 명이 왔는지는 그 자리에서 할 수 있는
 * 가장 정직한 이야기다.
 *
 * 개인 단위는 한 줄도 안 들어간다 — event_recap 은 집계뿐이다.
 */
export const pastTotals = unstable_cache(
  async () => {
    const supabase = publicClient();
    const { data } = await supabase
      .from("event_recap")
      .select("came, booked, solo");
    const rows = (data ?? []) as {
      came: number;
      booked: number;
      solo: number;
    }[];
    if (!rows.length) return null;
    return {
      parties: rows.length,
      // 입장 체크를 안 한 파티는 예매 수로 센다
      people: rows.reduce((a, r) => a + (r.came || r.booked), 0),
      solo: rows.reduce((a, r) => a + r.solo, 0),
    };
  },
  ["past-totals"],
  { revalidate: 300, tags: [PARTY_TAG] },
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

/**
 * 내 쿠폰. **입장권과 따로 읽는다.**
 *
 * 입장은 예매 한 건에 한 장이고 쿠폰은 인원수만큼이다. 한 화면에 섞으면
 * 바 앞에서 "내 드링크가 몇 잔 남았지" 를 예매 목록에서 뒤지게 된다.
 *
 * 다 쓴 쿠폰도 가져온다 — 몇 잔 마셨는지가 정산 다툼의 근거다.
 */
export async function myPerks(): Promise<
  (BookingPerk & {
    perk: EventPerk;
    booking: Booking & { event: EventRow };
  })[]
> {
  const user = await currentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("booking_perks")
    .select("*, perk:event_perks (*), booking:bookings (*, event:events (*))")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as (BookingPerk & {
    perk: EventPerk | null;
    booking: (Booking & { event: EventRow | null }) | null;
  })[];

  // 조인이 비면 화면이 깨진다. 취소된 예매의 쿠폰도 여기서 뺀다
  return rows.filter(
    (r) => r.perk && r.booking?.event && r.booking.status !== "cancelled",
  ) as (BookingPerk & { perk: EventPerk; booking: Booking & { event: EventRow } })[];
}

/** 크루 목록. 하루에 몇 번 바뀌지도 않는데 요청마다 읽을 이유가 없다 */
/**
 * 끝난 파티. **기록으로만 보여 준다.**
 *
 * 지우지 않는 이유는 처음 오는 사람이 제일 궁금해하는 게 "지난번엔
 * 어땠나" 이기 때문이다. 파는 판이 아니라 증거다.
 */
export async function listPastParties(limit = 6): Promise<EventRow[]> {
  const supabase = publicClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("status", "done")
    .order("starts_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as EventRow[];
}

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

export type HomeReview = {
  id: string;
  rating: number;
  body: string;
  nickname: string;
  created_at: string;
  event: { title: string; slug: string } | null;
};

/**
 * 최근 후기 몇 개. **파티 사이 기간에 홈이 내놓을 수 있는 두 번째 증거다.**
 *
 * 숫자(몇 명 왔나)는 크기를 말하고 후기는 분위기를 말한다. 처음 온
 * 사람이 예매 버튼을 누르기 전에 보는 건 결국 남이 뭐라고 했느냐다.
 *
 * 닉네임과 본문뿐이다. 개인을 가리키는 건 없다.
 */
export const recentReviews = unstable_cache(
  async (limit = 4): Promise<HomeReview[]> => {
    const { data } = await publicClient()
      .from("reviews")
      .select("id, rating, body, nickname, created_at, event:events (title, slug)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as unknown as HomeReview[];
  },
  ["home-reviews"],
  { revalidate: 120, tags: [PARTY_TAG] },
);
