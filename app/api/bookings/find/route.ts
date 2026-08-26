import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/types/database";

/**
 * 티켓 찾기. 두 가지로 찾는다.
 *
 *  1. 이름 + 연락처 — 예매번호를 모를 때. **기본 경로다.**
 *     문자를 지웠거나 기기를 바꾼 사람은 PM0001 을 모른다.
 *  2. 예매번호 + 연락처 — 한 건만 콕 집을 때
 *
 * **연락처만으로는 안 연다.** 번호만 넣으면 남의 번호를 아는 사람이 그
 * 사람이 어느 파티에 가는지 다 본다.
 *
 * 찾은 티켓은 지금 세션에 붙인다. 다음부터는 목록에 그냥 뜬다.
 */
export async function POST(req: Request) {
  const { code, phone, name } = (await req.json().catch(() => ({}))) as {
    code?: string;
    phone?: string;
    name?: string;
  };

  if (!phone?.trim()) {
    return NextResponse.json(
      { message: "연락처를 적어 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const byCode = Boolean(code?.trim());

  if (!byCode && !name?.trim()) {
    return NextResponse.json(
      { message: "이름을 적어 주세요. 예매할 때 쓴 이름이어야 해요." },
      { status: 400 },
    );
  }

  const { data, error } = byCode
    ? await supabase.rpc("claim_booking", {
        p_code: code!.trim(),
        p_phone: phone.trim(),
      })
    : await supabase.rpc("claim_bookings_by_phone", {
        p_phone: phone.trim(),
        p_name: name!.trim(),
      });

  if (error) {
    const kind = (error.message ?? "").trim();
    return NextResponse.json(
      {
        message:
          kind === "BAD_PHONE"
            ? "연락처를 다시 확인해 주세요."
            : kind === "BAD_NAME"
              ? "이름을 적어 주세요."
              : byCode
                ? "그 예매번호와 연락처로 찾은 티켓이 없어요."
                : "그 이름과 연락처로 찾은 티켓이 없어요. 예매할 때 쓴 이름이 맞는지 확인해 주세요.",
      },
      { status: 404 },
    );
  }

  const rows = (Array.isArray(data) ? data : [data]) as Booking[];
  if (rows.length === 0) {
    return NextResponse.json(
      { message: "찾은 티켓이 없어요." },
      { status: 404 },
    );
  }

  // 손님이 정말 필요한 건 계좌다. 한 번 더 왕복시키지 않고 같이 실어 보낸다
  const { data: events } = await supabase
    .from("events")
    .select("id, title, bank_account")
    .in("id", [...new Set(rows.map((r) => r.event_id))]);

  const byId = new Map(
    (events ?? []).map((e) => [
      e.id,
      { title: e.title, bank_account: e.bank_account },
    ]),
  );

  return NextResponse.json({
    tickets: rows.map((r) => ({
      ...r,
      event_title: byId.get(r.event_id)?.title ?? null,
      bank_account: byId.get(r.event_id)?.bank_account ?? null,
    })),
  });
}
