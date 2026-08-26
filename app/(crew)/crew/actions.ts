"use server";

import { revalidatePath } from "next/cache";

import { pushReady, sendPush } from "@/lib/push";
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
  return { ok: true };
}

/** 입금 확정 알림. 그 사람 기기로만 간다 */
async function notifyPaid(bookingId: string) {
  if (!pushReady()) return;
  const supabase = await createClient();

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
    .select("endpoint, p256dh, auth")
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
  return { ok: true };
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
  revalidatePath("/", "layout");
  return { ok: true };
}
