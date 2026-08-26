/**
 * 도메인 규칙. **사양서 3절이 이 제품의 본질이다** — 여기 있는 값과 식은
 * 임의로 바꾸지 않는다.
 *
 * 주의: 이 파일의 계산은 **화면에 보여주기 위한 것**이다. 예매를 실제로
 * 막는 검증은 전부 서버 트랜잭션(`create_booking` RPC)이 한다.
 * 클라이언트에서 잔여를 계산해 통과시키는 방식은 금지다(사양서 7절).
 */

/**
 * 플랫폼 수수료. **입금 완료된 건에만** 매긴다.
 *
 * 여기만 고쳐서는 안 된다 — DB 의 platform_stats 뷰가 같은 숫자를 따로
 * 들고 있다. 운영 화면이 뷰에서 읽으므로 둘이 어긋나면 크루에게 청구한
 * 값과 우리가 보는 값이 달라진다. 바꿀 때 supabase/FEE.sql 을 같이 돌린다.
 */
export const FEE_RATE = 0.1;

/** 신청 후 이 시간 안에 입금이 없으면 자동 취소된다 */
export const HOLD_HOURS = 24;

/**
 * 행사 며칠 전부터 환불이 안 되는가.
 *
 * 파티는 인원에 맞춰 술·자리·인력을 미리 잡는다. 코앞에서 빠지면 그
 * 비용이 그대로 남는다 — 그래서 일주일을 자른다.
 *
 * **미입금 취소와는 다른 이야기다.** 돈을 안 낸 건은 돌려줄 것이 없고,
 * 오히려 빨리 빼 줘야 자리가 돈다. 이 규칙은 입금이 확인된 건에만 건다.
 */
export const REFUND_CUTOFF_DAYS = 7;

/** 아직 환불을 요청할 수 있는 기간인가 */
export function refundOpen(startsAt: string, now: Date = new Date()): boolean {
  const days =
    (new Date(startsAt).getTime() - now.getTime()) / 86_400_000;
  return days > REFUND_CUTOFF_DAYS;
}

export type Gender = "F" | "M";
export type BookingStatus = "pending" | "paid" | "checked_in" | "cancelled";

/** 성비 조절이 켜진 파티에서 한 성별이 받을 수 있는 최대 인원 */
export function genderCap(capacity: number): number {
  return Math.floor(capacity / 2);
}

/**
 * 성별 티켓 가격.
 *
 * **차수에 남성가가 적혀 있으면 그게 이긴다.** 크루는 계수가 아니라 두
 * 가격을 따로 정한다 — 1차 39/49, 3차 59/69 처럼. 계수만 쓰면 3차가
 * 59,000 × 1.25 = 74,000 으로 나와서 실제 69,000 과 어긋난다.
 *
 * 안 적혀 있으면 예전대로 계수를 곱하고 **천 원 단위로 반올림한다** —
 * 현장에서 계좌이체를 받으므로 끝자리가 깔끔해야 한다.
 *
 * 이건 화면에 보여주기 위한 사본이다. 실제 금액은 서버의 tier_price() 가
 * 정한다 — 둘이 어긋나면 서버가 맞다.
 */
export function priceFor(
  tierPrice: number,
  gender: Gender,
  maleMultiplier: number,
  malePrice?: number | null,
): number {
  if (gender !== "M") return tierPrice;
  if (malePrice != null) return malePrice;
  return Math.round((tierPrice * maleMultiplier) / 1000) * 1000;
}

/** 정가 대비 할인율(%). 0 이하면 배지를 안 띄운다 */
export function discountRate(listPrice: number, price: number): number {
  if (!listPrice || price >= listPrice) return 0;
  return Math.round((1 - price / listPrice) * 100);
}

/** 예매율(%) */
export function soldRate(booked: number, capacity: number): number {
  if (!capacity) return 0;
  return Math.min(100, Math.round((booked / capacity) * 100));
}

/** 잔여가 30% 이하면 마감 임박으로 본다 — 카드에서 핫 컬러로 바뀐다 */
export function isClosingSoon(booked: number, capacity: number): boolean {
  if (!capacity) return false;
  return (capacity - booked) / capacity <= 0.3;
}

/** 정산: 확정 매출에서 수수료와 크루 지출을 뺀다 (사양서 6절) */
export function settle(paidRevenue: number, expenses: number[]) {
  const fee = Math.round(paidRevenue * FEE_RATE);
  const spend = expenses.reduce((a, b) => a + b, 0);
  return { gross: paidRevenue, fee, spend, net: paidRevenue - fee - spend };
}
