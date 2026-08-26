import { NextResponse } from "next/server";

import { limit, who } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";

/**
 * 예매 생성. **이 라우트는 값을 검사만 하고 자리 계산은 하지 않는다** —
 * 정원·성비·차수는 전부 create_booking 안에서 행을 잠그고 본다.
 *
 * RPC 가 던지는 에러는 'CODE:잔여' 형태다. 그걸 사람 말로 바꿔 돌려준다.
 */

const MESSAGES: Record<string, (left: number) => string> = {
  EVENT_NOT_OPEN: () => "지금은 예매를 받지 않는 파티예요.",
  TIER_NOT_FOUND: () => "선택한 차수를 찾을 수 없어요. 새로고침해 주세요.",
  TIER_SOLD_OUT: (n) =>
    n > 0
      ? `이 차수는 ${n}장 남았어요. 인원을 줄이거나 다음 차수를 선택해 주세요.`
      : "이 차수는 매진됐어요. 다음 차수를 선택해 주세요.",
  CAPACITY_EXCEEDED: (n) =>
    n > 0 ? `남은 자리가 ${n}자리예요.` : "정원이 다 찼어요.",
  GENDER_CAPACITY_EXCEEDED: (n) =>
    n > 0
      ? `해당 성별은 ${n}자리 남았어요.`
      : "해당 성별은 마감됐어요. 성비를 맞추려고 남녀 정원을 나눠 받고 있어요.",
  BAD_GENDER: () => "성별을 선택해 주세요.",
  BAD_QUANTITY: () => "인원은 1명에서 4명까지예요.",
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "잘못된 요청이에요." }, { status: 400 });
  }

  const { eventId, tierId, name, phone, gender, quantity, inviteCode } =
    body as {
      eventId?: string;
      tierId?: string;
      name?: string;
      phone?: string;
      gender?: string;
      quantity?: number;
      inviteCode?: string | null;
    };

  if (!eventId || !tierId || !name?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { message: "이름과 연락처를 모두 적어 주세요." },
      { status: 400 },
    );
  }
  if (gender !== "F" && gender !== "M") {
    return NextResponse.json({ message: "성별을 선택해 주세요." }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 4) {
    return NextResponse.json(
      { message: "인원은 1명에서 4명까지예요." },
      { status: 400 },
    );
  }

  /**
   * **여기가 제일 큰 구멍이었다.** 예매는 로그인 없이 받고 신청하면
   * 24시간 자리를 잡는다. 막지 않으면 누구든 스크립트로 정원을 통째로
   * 잠글 수 있다 — 돈 한 푼 안 들이고 파티 하나를 죽이는 방법이다.
   *
   * 같은 IP 로 분당 5건, 같은 번호로 시간당 6건. 사람이 실수로 두세 번
   * 누르는 건 통과하고, 기계로 쏟아붓는 건 막힌다.
   */
  const ip = who(req);
  const digits = phone.replace(/[^0-9]/g, "");
  const [ipOk, phoneOk] = await Promise.all([
    limit(`book:ip:${ip}`, 5, 60),
    limit(`book:phone:${digits}`, 6, 3600),
  ]);
  if (!ipOk || !phoneOk) {
    return NextResponse.json(
      { message: "잠시 뒤에 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_event_id: eventId,
    p_tier_id: tierId,
    p_name: name.trim(),
    p_phone: phone.trim(),
    p_gender: gender,
    p_quantity: qty,
    p_invite_code: inviteCode ?? null,
  });

  if (error) {
    const raw = error.message ?? "";
    const [code, leftStr] = raw.split(":");
    const make = MESSAGES[code.trim()];
    if (make) {
      return NextResponse.json(
        { code: code.trim(), left: Number(leftStr ?? 0), message: make(Number(leftStr ?? 0)) },
        { status: 409 },
      );
    }
    console.error("create_booking", error);
    return NextResponse.json(
      { message: "예매 처리 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
