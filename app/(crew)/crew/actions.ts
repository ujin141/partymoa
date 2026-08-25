"use server";

import { revalidatePath } from "next/cache";

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
  revalidatePath("/crew", "layout");
  return { ok: true };
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
