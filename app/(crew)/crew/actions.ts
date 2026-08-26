"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { PARTY_TAG } from "@/lib/queries";
import { pushReady, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 입금 확인 토글. RLS 가 "이 행사 크루 스태프만" 을 이미 막고 있으므로
 * 여기서 권한을 다시 검사하지 않는다 — 두 군데서 검사하면 한 군데가 낡는다.
 */
export async function setPaid(bookingId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update(
      paid
        ? { status: "paid", paid_at: new Date().toISOString() }
        : // 입금을 되돌리면 입장도 함께 되돌린다. 입금 안 된 사람이
          // 입장 완료로 남아 있으면 현장에서 사고가 난다
          { status: "pending", paid_at: null, checked_in_at: null },
    )
    .eq("id", bookingId);
  if (error) return { ok: false, message: error.message };

  // **손님이 제일 기다리는 소식이다.** 입금하고 나서 확정됐는지 몰라
  // 크루에게 다시 묻는 일이 제일 많다. 알림이 실패해도 입금 확인 자체는
  // 이미 끝났으므로 막지 않는다
  if (paid) await notifyPaid(bookingId).catch(() => null);

  revalidatePath("/crew", "layout");
  revalidateTag(PARTY_TAG);
  return { ok: true };
}

/** 입금 확정 알림. 그 사람 기기로만 간다 */
async function notifyPaid(bookingId: string) {
  if (!pushReady()) return;
  // 손님 구독을 읽어야 하는데 정책이 "본인 것만" 이다. 여기만 뚫는다
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("bookings")
    .select("id, code, user_id, event:events (title)")
    .eq("id", bookingId)
    .maybeSingle();
  const b = data as unknown as
    | { id: string; code: string; user_id: string | null; event: { title: string } }
    | null;
  if (!b?.user_id) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, platform")
    .eq("user_id", b.user_id)
    .is("failed_at", null);

  const dead: string[] = [];
  for (const s of subs ?? []) {
    const alive = await sendPush(s, {
      title: "입금 확인됐어요",
      body: `${b.event.title} · ${b.code} 예매가 확정됐습니다.`,
      url: "/tickets",
      tag: `${b.id}-paid`,
    });
    if (!alive) dead.push(s.endpoint);
  }
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }
  await supabase
    .from("push_log")
    .upsert({ booking_id: b.id, kind: "paid" }, { onConflict: "booking_id,kind" });
}

export async function setCheckedIn(bookingId: string, inside: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update(
      inside
        ? { status: "checked_in", checked_in_at: new Date().toISOString() }
        : { status: "paid", checked_in_at: null },
    )
    .eq("id", bookingId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/crew", "layout");
  revalidateTag(PARTY_TAG);
  return { ok: true };
}

export async function cancelBooking(bookingId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/crew", "layout");
  revalidateTag(PARTY_TAG);
  return { ok: true };
}

/**
 * 예매 한 건의 추천인을 고친다. 빈 값이면 뗀다.
 *
 * **금액을 인자로 받지 않는다.** 코드만 넘기고 금액은 DB 의 tier_price 가
 * 다시 계산한다 — 크루가 손으로 적게 두면 정산이 어긋나고, 어긋난 걸
 * 나중에 아무도 못 찾는다.
 */
export async function setBookingInvite(bookingId: string, code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_booking_invite", {
    p_booking: bookingId,
    p_code: code.trim() || null,
  });
  if (error) {
    const kind = (error.message ?? "").trim();
    return {
      ok: false as const,
      message:
        kind === "UNKNOWN_CODE"
          ? "그 코드를 가진 멤버가 없어요. 크루 관리에서 먼저 추가해 주세요."
          : kind === "FORBIDDEN"
            ? "이 행사의 스태프만 고칠 수 있어요."
            : kind === "NOT_FOUND"
              ? "그 예매를 찾을 수 없어요."
              : // DB 쪽 함수가 아직 안 올라간 경우. 배포는 나갔는데
                // INVITE_FIX.sql 을 안 돌리면 여기로 온다
                /Could not find the function|does not exist/i.test(kind)
                ? "아직 준비가 안 된 기능이에요. INVITE_FIX.sql 을 먼저 실행해 주세요."
                : error.message,
    };
  }
  revalidatePath("/crew", "layout");
  return { ok: true as const, amount: (data as { amount: number }).amount };
}

/**
 * 성별을 고친다. **금액을 같이 바꿀지는 호출한 쪽이 정한다.**
 *
 * 성별이 바뀌면 가격이 달라질 수 있는데(남성가), 이미 그 금액으로 입금이
 * 끝난 사람이 있다. 자동으로 바꾸면 받은 돈과 기록이 어긋난다.
 */
export async function setBookingGender(
  bookingId: string,
  gender: "F" | "M",
  reprice: boolean,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_booking_gender", {
    p_booking: bookingId,
    p_gender: gender,
    p_reprice: reprice,
  });
  if (error) {
    const kind = (error.message ?? "").trim();
    return {
      ok: false as const,
      message:
        kind === "FORBIDDEN"
          ? "이 행사의 스태프만 고칠 수 있어요."
          : kind === "NOT_FOUND"
            ? "그 예매를 찾을 수 없어요."
            : /Could not find the function|does not exist/i.test(kind)
              ? "아직 준비가 안 된 기능이에요. GENDER_EDIT.sql 을 먼저 실행해 주세요."
              : error.message,
    };
  }
  revalidatePath("/crew", "layout");
  return { ok: true as const, amount: (data as { amount: number }).amount };
}

export async function setEventStatus(
  eventId: string,
  status: "draft" | "open" | "closed" | "done",
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/crew", "layout");
  revalidateTag(PARTY_TAG);
  revalidatePath("/", "layout");
  return { ok: true };
}
