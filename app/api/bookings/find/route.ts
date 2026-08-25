import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * 예매번호 + 연락처로 티켓 찾기. 로그인한 세션이 있으면 그 티켓을
 * 세션에 붙여 다음부터는 목록에 그냥 뜨게 한다.
 */
export async function POST(req: Request) {
  const { code, phone } = (await req.json().catch(() => ({}))) as {
    code?: string;
    phone?: string;
  };
  if (!code?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { message: "예매번호와 연락처를 모두 적어 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_booking", {
    p_code: code.trim(),
    p_phone: phone.trim(),
  });

  if (error) {
    const kind = (error.message ?? "").trim();
    return NextResponse.json(
      {
        message:
          kind === "BAD_PHONE"
            ? "연락처를 다시 확인해 주세요."
            : "그 예매번호와 연락처로 찾은 티켓이 없어요.",
      },
      { status: 404 },
    );
  }
  // 손님이 정말 필요한 건 계좌다. 한 번 더 왕복시키지 않고 같이 실어 보낸다
  const { data: event } = await supabase
    .from("events")
    .select("title, bank_account")
    .eq("id", data.event_id)
    .maybeSingle();

  return NextResponse.json({
    ...data,
    event_title: event?.title ?? null,
    bank_account: event?.bank_account ?? null,
  });
}
