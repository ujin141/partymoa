import "server-only";

import { pushReady, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 호스트에게 "예매 들어왔다" 를 보낸다.
 *
 * **크론에 안 맡긴다.** 크론은 30분마다 돈다. 마감이 걸린 파티에서
 * 30분은 자리가 다 차고도 남는 시간이고, 호스트가 알림을 늦게 받으면
 * 그 사이 입금 독촉도 못 한다. 예매가 들어온 그 요청에서 바로 보낸다.
 *
 * **실패해도 예매를 막지 않는다.** 부르는 쪽에서 await 하지 않고
 * 흘려보낸다 — 알림은 곁다리다.
 *
 * **밤에도 보낸다.** 야간 발송 제한(정보통신망법 50조)은 광고성 정보
 * 얘기다. 이건 자기 가게에 손님이 왔다는 업무 알림이라 해당이 없다.
 * 새벽 파티를 여는 사람들이라 어차피 그때 깨어 있다.
 */
export async function notifyHostBooked(bookingId: string) {
  if (!pushReady()) return;

  // 크루의 구독을 읽어야 한다. 손님 정책으로는 남의 구독을 못 본다
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, code, name, gender, quantity, event:events (id, title, crew_id, capacity)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const b = data as unknown as
    | {
        id: string;
        code: string;
        name: string;
        gender: "F" | "M";
        quantity: number;
        event: { id: string; title: string; crew_id: string; capacity: number };
      }
    | null;
  if (!b?.event) return;

  /**
   * 받을 사람 — 대표와 크루원.
   *
   * **user_id 가 있는 사람만.** DJ 코드는 집계용이라 계정이 안 붙어
   * 있고(AFTER_MOON.sql), 붙었더라도 손님 명단을 볼 사람이 아니다.
   * 앱 심사용 REVIEW 계정도 뺀다 — 심사자 폰을 울릴 이유가 없다.
   */
  const [{ data: crew }, { data: members }] = await Promise.all([
    supabase.from("crews").select("owner_id").eq("id", b.event.crew_id).maybeSingle(),
    supabase
      .from("crew_members")
      .select("user_id, invite_code")
      .eq("crew_id", b.event.crew_id)
      .not("user_id", "is", null),
  ]);

  const ids = new Set<string>();
  if (crew?.owner_id) ids.add(crew.owner_id as string);
  for (const m of (members ?? []) as { user_id: string; invite_code: string }[]) {
    if (m.invite_code !== "REVIEW") ids.add(m.user_id);
  }
  if (ids.size === 0) return;

  // 몇 자리 남았는지. 호스트가 제일 먼저 보는 숫자다
  const { data: stat } = await supabase
    .from("event_stats")
    .select("capacity, booked")
    .eq("event_id", b.event.id)
    .maybeSingle();
  const left =
    stat && typeof stat.booked === "number" && typeof stat.capacity === "number"
      ? stat.capacity - stat.booked
      : null;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, platform")
    .in("user_id", [...ids])
    .is("failed_at", null);
  if (!subs?.length) return;

  const who = `${b.name} · ${b.gender === "F" ? "여" : "남"} ${b.quantity}명`;
  const dead: string[] = [];
  for (const s of subs) {
    const alive = await sendPush(s, {
      title: "예매 들어왔어요",
      body:
        `${b.event.title} · ${who}` +
        (left !== null ? `\n${left}자리 남음 · ${b.code}` : `\n${b.code}`),
      // 명단으로 바로 떨군다. 알림을 보는 이유는 대개 입금 확인이다
      url: "/crew/manage",
      tag: `${b.id}-host`,
    });
    if (!alive) dead.push(s.endpoint);
  }
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  // 크론이 같은 건으로 또 보내지 않게 남긴다
  await supabase
    .from("push_log")
    .upsert({ booking_id: b.id, kind: "host" }, { onConflict: "booking_id,kind" });
}
