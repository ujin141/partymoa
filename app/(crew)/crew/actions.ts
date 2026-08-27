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

export interface ManualGuest {
  eventId: string;
  name: string;
  phone: string;
  gender: "F" | "M";
  quantity: number;
  tierId: string | null;
  inviteCode: string | null;
  tableId: string | null;
  /** 비우면 차수 가격으로 계산한다 */
  amount: number | null;
  paid: boolean;
  /** 정원·성비를 넘어도 넣는다. 화면이 한 번 물은 뒤에만 true */
  force: boolean;
}

/**
 * 명단에 손님을 직접 넣는다. DM·전화·현장으로 받은 건.
 *
 * **정원과 성비를 넘으면 그냥 안 넣는다.** 크루가 사정을 알고 넣는 거라
 * 막지는 않지만, 모르고 넘기는 일도 많다 — 한 번 묻고 force 로 다시 온다.
 */
export async function addGuest(g: ManualGuest) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_booking_manual", {
    p_event_id: g.eventId,
    p_name: g.name.trim(),
    p_phone: g.phone.trim(),
    p_gender: g.gender,
    p_quantity: g.quantity,
    p_tier_id: g.tierId,
    p_invite_code: g.inviteCode?.trim() || null,
    p_table_id: g.tableId,
    p_amount: g.amount,
    p_paid: g.paid,
    p_force: g.force,
  });

  if (error) {
    const raw = (error.message ?? "").trim();
    const [code, leftStr] = raw.split(":");
    const left = Number(leftStr ?? 0);
    const MSG: Record<string, string> = {
      FORBIDDEN: "이 행사의 스태프만 넣을 수 있어요.",
      NEED_NAME_PHONE: "이름과 연락처를 모두 적어 주세요.",
      BAD_GENDER: "성별을 골라 주세요.",
      BAD_QUANTITY: "인원은 1명에서 10명까지예요.",
      TIER_NOT_FOUND: "열려 있는 차수가 없어요. 파티 수정에서 차수를 여세요.",
      EVENT_NOT_FOUND: "그 파티를 찾을 수 없어요.",
      DUPLICATE: "같은 이름과 번호가 이미 명단에 있어요.",
    };
    if (code === "OVER_CAPACITY" || code === "OVER_GENDER") {
      return {
        ok: false as const,
        over: true,
        message:
          code === "OVER_CAPACITY"
            ? `정원을 넘습니다. 남은 자리 ${Math.max(0, left)}자리.`
            : `그 성별 정원을 넘습니다. 남은 자리 ${Math.max(0, left)}자리.`,
      };
    }
    return {
      ok: false as const,
      over: false,
      message:
        MSG[code] ??
        (/Could not find the function|does not exist/i.test(raw)
          ? "아직 준비가 안 된 기능이에요. ADD_GUEST.sql 을 먼저 실행해 주세요."
          : raw),
    };
  }

  revalidatePath("/crew", "layout");
  revalidateTag(PARTY_TAG);
  return { ok: true as const, code: (data as { code: string }).code };
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
