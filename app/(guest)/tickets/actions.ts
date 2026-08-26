"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { PARTY_TAG } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const SAY: Record<string, string> = {
  NOT_FOUND: "없는 예매예요.",
  NOT_YOURS: "이 기기로 예매한 건만 취소할 수 있어요.",
  ALREADY_IN: "이미 입장한 예매는 취소할 수 없어요.",
  PAID: "입금이 확인된 예매예요. 환불이 있어서 주최 크루가 처리합니다.",
};

/**
 * 내 예매 취소.
 *
 * **미입금만 된다.** 입금한 건은 환불이 얽혀 있어 크루가 처리해야 한다.
 * 판정은 DB 의 cancel_my_booking 이 하고, 여기서는 그 이유를 사람 말로
 * 옮기기만 한다.
 */
export async function cancelMyBooking(bookingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_booking", {
    p_booking: bookingId,
  });
  if (error) {
    const kind = (error.message ?? "").trim();
    return { ok: false as const, message: SAY[kind] ?? "취소하지 못했어요." };
  }
  revalidatePath("/tickets");
  revalidatePath("/", "layout");
  revalidateTag(PARTY_TAG);
  return { ok: true as const };
}
