import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { phoneMask, phoneOk } from "@/lib/format";
import { notifyBooked } from "@/lib/notify";
import { PARTY_TAG } from "@/lib/queries";
import { limit, who } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 예매 생성. **이 라우트는 값을 검사만 하고 자리 계산은 하지 않는다** —
 * 정원·성비·차수는 전부 create_booking 안에서 행을 잠그고 본다.
 *
 * RPC 가 던지는 에러는 'CODE:잔여' 형태다. 그걸 사람 말로 바꿔 돌려준다.
 */

const MESSAGES: Record<string, (left: number) => string> = {
  EVENT_NOT_OPEN: () => "지금은 예매를 받지 않는 파티예요.",
  // 같은 번호로는 한 건만 받는다. **왜 막혔는지까지 적어 준다** —
  // 남녀가 같이 오면 성별이 달라 두 건으로 나눠야 하는데, 그때는
  // 각자 번호로 넣으면 된다는 걸 여기서 알려 줘야 다음 행동이 나온다
  ALREADY_BOOKED: () =>
    "이 번호로 이미 예매하셨어요. 인원을 바꾸려면 예매를 취소하고 다시 해 주세요. 일행은 각자 번호로 예매하면 돼요.",
  TIER_NOT_FOUND: () => "선택한 차수를 찾을 수 없어요. 새로고침해 주세요.",
  // 이 줄이 빠져 있어서 닫힌 차수를 고르면 500 이 나갔다
  TIER_CLOSED: () => "이 차수는 마감됐어요. 다른 차수를 선택해 주세요.",
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
  BAD_PHONE: () => "연락처를 다시 확인해 주세요.",
  BAD_NAME: () => "이름을 다시 확인해 주세요.",
  NO_SESSION: () => "세션이 없어요. 새로고침한 뒤 다시 해 주세요.",
  // DB 안의 제한(같은 번호 시간당 3건 · 전체 10분 60건)에 걸렸다.
  // 라우트의 IP 제한과 별개다 — RPC 를 직접 부르는 쪽도 여기서 막힌다
  RATE: () => "너무 여러 번 시도했어요. 잠시 뒤에 다시 해 주세요.",
  PENDING_CAP: () =>
    "입금 대기 중인 예매가 이미 2건이에요. 일행은 한 예매에 인원(최대 4명)으로 넣거나, 입금·취소 뒤 다시 해 주세요.",
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "잘못된 요청이에요." }, { status: 400 });
  }

  const {
    eventId, tierId, name, phone, gender, quantity, inviteCode, instagram,
  } = body as {
      eventId?: string;
      tierId?: string;
      name?: string;
      phone?: string;
      gender?: string;
      quantity?: number;
      inviteCode?: string | null;
      instagram?: string | null;
    };

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof eventId !== "string" || !UUID.test(eventId) || typeof tierId !== "string" || !UUID.test(tierId)) {
    return NextResponse.json({ message: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!eventId || !tierId || !name?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { message: "이름과 연락처를 모두 적어 주세요." },
      { status: 400 },
    );
  }
  /**
   * **화면에서 이미 막지만 여기서 또 막는다.** 이 경로는 fetch 한 줄로
   * 부를 수 있어서, 화면 검사만 두면 아무 값이나 들어온다. 연락 안 되는
   * 번호로 잡힌 자리는 24시간 동안 아무도 못 산다.
   */
  if (!phoneOk(phone)) {
    return NextResponse.json(
      { message: "연락처를 다시 확인해 주세요." },
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
  const [ipUnder, numUnder] = await Promise.all([
    limit(`book:ip:${ip}`, 5, 60),
    limit(`book:phone:${digits}`, 6, 3600),
  ]);
  if (!ipUnder || !numUnder) {
    return NextResponse.json(
      { message: "잠시 뒤에 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  /**
   * **create_booking 은 이제 service_role 만 부른다.** 손님 키로 열어
   * 두면 이 라우트를 건너뛰고 RPC 를 직접 때려 IP 제한·번호 검사를 다
   * 피할 수 있었다. 예매가 계정에 붙도록 손님 uid 는 따로 넘긴다.
   * 키가 없는 로컬에서는 손님 세션으로 부른다 (거기선 grant 를 안 뺐다고
   * 가정한다).
   */
  const { data: auth } = await supabase.auth.getUser();
  // 세션 없는 호출은 안 받는다. 앱은 첫 화면에서 세션을 만든다 — 없다는 건
  // 스크립트다. 계정당 미입금 상한이 세션에 걸리므로 이게 없으면 상한이 빈다
  if (!auth?.user) {
    return NextResponse.json(
      { message: "세션이 없어요. 새로고침한 뒤 다시 해 주세요." },
      { status: 401 },
    );
  }
  const admin = createAdminClient();
  if (!admin && process.env.VERCEL) {
    // 키가 빠지면 예매가 통째로 죽는다. 조용히 500 이 아니라 크게 남긴다
    console.error("bookings: SUPABASE_SERVICE_ROLE_KEY 없음");
    return NextResponse.json(
      { message: "지금은 예매를 받을 수 없어요. 잠시 뒤 다시 해 주세요." },
      { status: 503 },
    );
  }
  const args = {
    p_event_id: eventId,
    p_tier_id: tierId,
    p_name: name.trim(),
    // 저장 모양을 하나로 맞춘다. 01012345678 과 010-1234-5678 이
    // 섞이면 크루가 같은 사람을 둘로 본다
    p_phone: phoneMask(phone),
    p_gender: gender,
    p_quantity: qty,
    p_invite_code: inviteCode ?? null,
    /**
     * 인스타 아이디. **선택 항목이라 틀렸다고 예매를 막지 않는다.**
     * 앞의 @ 와 붙여 넣은 주소를 걷어내고 인스타가 허용하는 글자만
     * 남긴다. 남는 게 없으면 그냥 비운다 — 여기서 되돌려 보내면
     * 손님은 왜 막혔는지 모른 채 예매를 포기한다.
     */
    p_instagram:
      (instagram ?? "")
        .trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/[/?#].*$/, "")
        .replace(/^@+/, "")
        .toLowerCase()
        .match(/^[a-z0-9._]{1,30}$/)?.[0] ?? null,
  };
  let { data, error } = admin
    ? await admin.rpc("create_booking", { ...args, p_user_id: auth?.user?.id ?? null })
    : await supabase.rpc("create_booking", args);
  // 배포와 SQL 적용 사이의 틈. 새 인자를 아직 모르는 DB 면 옛 모양으로
  // 손님 세션에서 한 번 더 부른다. HARDEN2.sql 이 돌고 나면 안 타는 길이다
  // PGRST202 = 그 이름·인자의 함수가 없다. 그때만 옛 길로 간다
  if (error && error.code === "PGRST202") {
    ({ data, error } = await supabase.rpc("create_booking", args));
  }

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
    // 통째로 찍으면 details 에 이름·번호가 실린다. 코드와 메시지만
    console.error("create_booking", error.code, error.message);
    return NextResponse.json(
      { message: "예매 처리 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요." },
      { status: 500 },
    );
  }
  /**
   * 프로필에 채워 둔다. **다음 예매 때 다시 안 적는다.**
   *
   * 마이 화면에 들어가 미리 적어 두는 사람은 거의 없다. 그런데 예매할
   * 때는 어차피 적는다 — 그때 받은 것을 그대로 두면 두 번째부터는 폼이
   * 채워진 채로 열린다.
   *
   * **비어 있을 때만 넣는다.** 일부러 다른 번호를 적어 둔 사람의 값을
   * 예매 한 번으로 덮으면 안 된다. 그리고 실패해도 예매는 이미 끝났으니
   * 막지 않는다.
   */
  try {
    if (auth?.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("real_name, phone")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      const patch: { phone?: string; real_name?: string } = {};
      if (!prof?.phone) patch.phone = phoneMask(phone);
      if (!prof?.real_name) patch.real_name = name.trim();
      if (Object.keys(patch).length) {
        await supabase
          .from("profiles")
          .upsert({ user_id: auth.user.id, ...patch }, { onConflict: "user_id" });
      }
    }
  } catch {
    // 예매는 이미 됐다. 프로필은 다음에 채워도 된다
  }

  // **잔여가 바뀌었으니 목록 캐시를 즉시 버린다.** 안 버리면 마감된
  // 파티가 잠깐 열려 보이고, 들어와서 매진을 본다
  revalidateTag(PARTY_TAG);

  /**
   * 알림 세 통 — 손님 입금 안내, 호스트 예매 알림, 성비 마감.
   *
   * **예매는 이미 끝났으니 기다리지 않는다.** await 하면 푸시 서버가
   * 느릴 때 손님의 완료 화면이 그만큼 늦게 뜬다. 실패해도 예매는 그대로다.
   */
  const booking = data as { id?: string } | null;
  if (booking?.id) void notifyBooked(booking.id).catch(() => null);

  return NextResponse.json(data);
}
