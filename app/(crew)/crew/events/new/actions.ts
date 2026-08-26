"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { myCrew } from "@/lib/crew";
import { fromSeoulInput } from "@/lib/format";
import { PARTY_TAG } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export interface EventDraft {
  /** 어느 크루의 파티인지. 여러 크루에 속할 수 있다 */
  crewId?: string;
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
  coupleFriendly?: boolean;
  ageMin?: number | null;
  ageMax?: number | null;
  crowd?: "korean" | "mixed" | "global" | null;
  genres: string[];
  categories: string[];
  listPrice: number;
  bankAccount: string;
  tiers: {
    name: string;
    note: string;
    price: number;
    malePrice: number | null;
    capacity: number;
    closed?: boolean;
  }[];
  tables: {
    id?: string;
    name: string;
    price: number;
    cardPrice: number | null;
    seats: number;
    note: string | null;
    sortOrder: number;
  }[];
  tablesNote: string;
  guestPrice: number | null;
  photos: { url: string; caption: string | null; sortOrder: number }[];
  lineups: { artist: string; time: string }[];
}

/** 제목에서 slug 를 만든다. 한글은 URL 에서 깨지므로 날짜 + 임의값으로 */
function makeSlug(title: string, startsAt: string) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const day = startsAt.slice(0, 10).replace(/-/g, "");
  const tail = Math.random().toString(36).slice(2, 6);
  return `${ascii || "party"}-${day}-${tail}`;
}

export async function createEvent(d: EventDraft) {
  const crew = await myCrew(d.crewId);
  if (!crew) return { ok: false as const, message: "크루 계정으로 로그인해 주세요." };

  if (!d.title.trim() || !d.venueName.trim() || !d.startsAt || !d.endsAt) {
    return { ok: false as const, message: "제목·장소·일시는 비울 수 없어요." };
  }
  // **입력값은 서울 시각이다.** 시대 없이 new Date 로 읽으면 서버(UTC)
  // 기준으로 해석돼 저장이 아홉 시간 밀린다
  const startsIso = fromSeoulInput(d.startsAt);
  const endsIso = fromSeoulInput(d.endsAt);
  if (!startsIso || !endsIso) {
    return { ok: false as const, message: "날짜·시간을 확인해 주세요." };
  }
  if (new Date(endsIso) <= new Date(startsIso)) {
    return { ok: false as const, message: "종료 시각이 시작보다 빨라요." };
  }
  if (!d.tiers.length) {
    return { ok: false as const, message: "차수를 최소 하나는 넣어 주세요." };
  }
  // 차수 상한의 합이 정원보다 작으면 정원을 못 채우고 끝난다
  const tierSum = d.tiers.reduce((a, t) => a + t.capacity, 0);
  if (tierSum < d.capacity) {
    return {
      ok: false as const,
      message: `차수 수량의 합(${tierSum})이 정원(${d.capacity})보다 적어요. 정원을 다 못 팝니다.`,
    };
  }

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      crew_id: crew.id,
      slug: makeSlug(d.title, d.startsAt),
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || null,
      description: d.description.trim() || null,
      cover_url: d.coverUrl.trim() || null,
      venue_name: d.venueName.trim(),
      area: d.area.trim() || "서울",
      address: d.address.trim() || null,
      starts_at: startsIso,
      ends_at: endsIso,
      capacity: d.capacity,
      gender_balanced: d.genderBalanced,
      male_price_multiplier: d.maleMultiplier,
      solo_friendly: d.soloFriendly,
      couple_friendly: d.coupleFriendly ?? false,
      age_min: d.ageMin ?? null,
      age_max: d.ageMax ?? null,
      crowd: d.crowd || null,
      genres: d.genres,
      categories: d.categories,
      list_price: d.listPrice,
      guest_price: d.guestPrice,
      bank_account: d.bankAccount.trim() || null,
      status: "draft",
    })
    .select()
    .single();

  if (error || !event) {
    return { ok: false as const, message: error?.message ?? "등록에 실패했어요." };
  }

  const tierRows = d.tiers.map((t, i) => ({
    event_id: event.id,
    name: t.name.trim() || `${i + 1}차`,
    note: t.note.trim() || null,
    price: t.price,
    male_price: t.malePrice,
    capacity: t.capacity,
    closed_at: t.closed ? new Date().toISOString() : null,
    sort_order: i,
  }));
  const { error: tErr } = await supabase.from("ticket_tiers").insert(tierRows);
  if (tErr) {
    // 차수 없는 행사는 예매를 못 받는다. 반쯤 만들어진 행사를 남기지 않는다
    await supabase.from("events").delete().eq("id", event.id);
    return { ok: false as const, message: tErr.message };
  }

  const lineRows = d.lineups
    .filter((l) => l.artist.trim() && l.time)
    .map((l, i) => ({
      event_id: event.id,
      artist_name: l.artist.trim(),
      starts_at: l.time,
      sort_order: i,
    }));
  if (lineRows.length) await supabase.from("lineups").insert(lineRows);

  // 테이블(메뉴판). 차수와 달리 없어도 파티는 돈다 — 빈 줄은 버린다
  const tableRows = d.tables
    .filter((t) => t.name.trim() && t.price >= 0 && t.seats > 0)
    .map((t, i) => ({
      event_id: event.id,
      name: t.name.trim(),
      price: t.price,
      card_price: t.cardPrice,
      seats: t.seats,
      note: t.note,
      sort_order: i,
    }));
  const photoRows = d.photos.map((x, i) => ({
    event_id: event.id,
    url: x.url,
    caption: x.caption,
    sort_order: i,
  }));
  if (photoRows.length) await supabase.from("event_photos").insert(photoRows);

  if (tableRows.length) {
    await supabase.from("event_tables").insert(tableRows);
    await supabase
      .from("events")
      .update({ tables_note: d.tablesNote.trim() || null })
      .eq("id", event.id);
  }

  revalidatePath("/crew", "layout");
  revalidateTag(PARTY_TAG);
  return { ok: true as const, eventId: event.id };
}
