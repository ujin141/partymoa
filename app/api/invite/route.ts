import { NextResponse } from "next/server";

import { limit, who } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";

/**
 * 초대 코드 확인.
 *
 * **크루 정보는 안 준다.** 코드가 맞는지와 그때 얼마인지만 준다 —
 * 아니면 코드를 돌려 가며 크루 멤버 목록을 캐낼 수 있다.
 */
export async function POST(req: Request) {
  const { eventId, code } = (await req.json().catch(() => ({}))) as {
    eventId?: string;
    code?: string;
  };
  if (!eventId || !code?.trim()) {
    return NextResponse.json({ valid: false, price: null });
  }

  // 코드를 돌려 가며 크루 멤버를 캐낼 수 있다. 손님이 한 번 치는 데
  // 필요한 건 몇 번이면 충분하다
  if (!(await limit(`invite:${who(req)}`, 20, 60))) {
    return NextResponse.json({ valid: false, price: null }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_invite", {
    p_event: eventId,
    p_code: code.trim(),
  });
  if (error) return NextResponse.json({ valid: false, price: null });

  const row = (Array.isArray(data) ? data[0] : data) as
    | { valid: boolean; price: number | null }
    | undefined;
  return NextResponse.json({
    valid: Boolean(row?.valid),
    price: row?.price ?? null,
  });
}
