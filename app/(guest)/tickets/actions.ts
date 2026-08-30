"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { PARTY_TAG } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const SAY: Record<string, string> = {
  NOT_FOUND: "없는 예매예요.",
  NOT_YOURS: "이 기기로 예매한 건만 취소할 수 있어요.",
  ALREADY_IN: "이미 입장한 예매는 취소할 수 없어요.",
  PAID: "입금이 확인된 예매예요. 환불이 있어서 호스트가 처리합니다.",
};

/**
 * 내 예매 취소.
 *
 * **미입금만 된다.** 입금한 건은 환불이 얽혀 있어 호스트가 처리해야 한다.
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

/**
 * 쿠폰 한 장 쓰기.
 *
 * **되돌릴 수 없다.** 손님이 되돌릴 수 있으면 그건 쿠폰이 아니다 —
 * 잘못 눌렀을 때는 크루가 되돌린다. 그래서 화면에서 한 번 더 묻는다.
 *
 * 남은 장수·시간 판정은 전부 DB 의 use_perk 가 한다. 여기서 다시
 * 세면 두 군데가 서로 다른 답을 내는 날이 온다.
 */
export async function redeemPerk(perkId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_perk", { p_id: perkId });
  if (error) {
    // DB 가 사람 말로 던진다. 그대로 보여 준다
    return { ok: false as const, message: error.message || "쓰지 못했어요." };
  }
  revalidatePath("/tickets");
  return { ok: true as const, left: data ? data.total - data.used : 0 };
}
