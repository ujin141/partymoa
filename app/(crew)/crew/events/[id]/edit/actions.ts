"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export interface EventPatch {
  title: string;
  subtitle: string;
  description: string;
  coverUrl: string;
  venueName: string;
  area: string;
  address: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  genderBalanced: boolean;
  maleMultiplier: number;
  soloFriendly: boolean;
  genres: string[];
  categories: string[];
  listPrice: number;
  bankAccount: string;
  tiers: {
    id?: string;
    name: string;
    note: string;
    price: number;
    capacity: number;
  }[];
  lineups: { artist: string; time: string }[];
}

/**
 * 파티 수정.
 *
 * **차수는 지우고 새로 넣지 않는다.** bookings.tier_id 가 차수를 참조하고
 * 있어서, 지우면 이미 팔린 티켓이 어느 차수였는지 사라진다. id 가 있는 건
 * update, 새 줄만 insert, 사라진 줄은 **예매가 없을 때만** 삭제한다.
 *
 * 라인업은 참조가 없으므로 통째로 갈아도 된다.
 */
export async function updateEvent(eventId: string, d: EventPatch) {
  if (!d.title.trim() || !d.venueName.trim() || !d.startsAt || !d.endsAt) {
    return { ok: false as const, message: "제목·장소·일시는 비울 수 없어요." };
  }
  if (new Date(d.endsAt) <= new Date(d.startsAt)) {
    return { ok: false as const, message: "종료 시각이 시작보다 빨라요." };
  }
  if (!d.tiers.length) {
    return { ok: false as const, message: "차수를 최소 하나는 넣어 주세요." };
  }

  const supabase = await createClient();

  // 이미 팔린 만큼보다 정원을 줄이면 장부가 음수가 된다
  const { data: stat } = await supabase
    .from("event_stats")
    .select("booked")
    .eq("event_id", eventId)
    .maybeSingle();
  const booked = stat?.booked ?? 0;
  if (d.capacity < booked) {
    return {
      ok: false as const,
      message: `이미 ${booked}명이 예매했어요. 정원을 그보다 줄일 수 없습니다.`,
    };
  }

  const { error } = await supabase
    .from("events")
    .update({
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || null,
      description: d.description.trim() || null,
      cover_url: d.coverUrl.trim() || null,
      venue_name: d.venueName.trim(),
      area: d.area.trim() || "서울",
      address: d.address.trim() || null,
      starts_at: new Date(d.startsAt).toISOString(),
      ends_at: new Date(d.endsAt).toISOString(),
      capacity: d.capacity,
      gender_balanced: d.genderBalanced,
      male_price_multiplier: d.maleMultiplier,
      solo_friendly: d.soloFriendly,
      genres: d.genres,
      categories: d.categories,
      list_price: d.listPrice,
      bank_account: d.bankAccount.trim() || null,
    })
    .eq("id", eventId);
  if (error) return { ok: false as const, message: error.message };

  // ── 차수 ──────────────────────────────────────────
  const { data: existing } = await supabase
    .from("ticket_tiers")
    .select("id")
    .eq("event_id", eventId);
  const keep = new Set(d.tiers.map((t) => t.id).filter(Boolean) as string[]);

  for (const row of existing ?? []) {
    if (keep.has(row.id)) continue;
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tier_id", row.id)
      .neq("status", "cancelled");
    if ((count ?? 0) > 0) {
      return {
        ok: false as const,
        message: "이미 팔린 차수는 지울 수 없어요. 수량을 0 대신 그대로 두세요.",
      };
    }
    await supabase.from("ticket_tiers").delete().eq("id", row.id);
  }

  for (const [i, t] of d.tiers.entries()) {
    const row = {
      event_id: eventId,
      name: t.name.trim() || `${i + 1}차`,
      note: t.note.trim() || null,
      price: t.price,
      capacity: t.capacity,
      sort_order: i,
    };
    const { error: tErr } = t.id
      ? await supabase.from("ticket_tiers").update(row).eq("id", t.id)
      : await supabase.from("ticket_tiers").insert(row);
    if (tErr) return { ok: false as const, message: tErr.message };
  }

  // ── 라인업 ────────────────────────────────────────
  await supabase.from("lineups").delete().eq("event_id", eventId);
  const lines = d.lineups
    .filter((l) => l.artist.trim() && l.time)
    .map((l, i) => ({
      event_id: eventId,
      artist_name: l.artist.trim(),
      starts_at: l.time,
      sort_order: i,
    }));
  if (lines.length) await supabase.from("lineups").insert(lines);

  revalidatePath("/crew", "layout");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
