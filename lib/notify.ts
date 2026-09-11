import "server-only";

import { genderCap } from "@/lib/rules";
import { pushReady, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushLog } from "@/types/database";

/**
 * 예매가 들어온 그 요청에서 보내는 알림들.
 *
 * **크론에 안 맡긴다.** 크론은 30분마다 돈다. 마감이 걸린 파티에서
 * 30분은 자리가 다 차고도 남고, 그 사이 입금 독촉도 못 한다.
 *
 * **실패해도 예매를 막지 않는다.** 부르는 쪽에서 await 하지 않고
 * 흘려보낸다 — 알림은 곁다리다.
 *
 * 세 통이 한 번에 나갈 수 있어서 예매를 한 번만 읽고 나눠 쓴다.
 */

type Sub = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  platform: string | null;
};

/** 보내고 죽은 구독은 지운다. 남겨 두면 매번 실패한다 */
async function fan(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  subs: Sub[],
  msg: { title: string; body: string; url: string; tag: string },
) {
  const dead: string[] = [];
  for (const s of subs) {
    if (!(await sendPush(s, msg))) dead.push(s.endpoint);
  }
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }
}

function subsOf(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userIds: string[],
) {
  return supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, platform")
    .in("user_id", userIds)
    .is("failed_at", null);
}

/** 두 번 보내지 않게 남긴다. 크론도 같은 표를 본다 */
function mark(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  booking_id: string,
  kind: PushLog["kind"],
) {
  return supabase
    .from("push_log")
    .upsert({ booking_id, kind }, { onConflict: "booking_id,kind" });
}

/**
 * 예매 직후에 나가는 것 전부.
 *
 *   guide   손님에게 — 계좌·금액·마감시각
 *   host    호스트에게 — 누가 몇 명 잡았나
 *   gender  호스트에게 — 한쪽 성별이 방금 찼다
 */
export async function notifyBooked(bookingId: string) {
  if (!pushReady()) return;

  // 손님·크루 구독을 다 읽어야 한다. 손님 정책으로는 남의 것을 못 본다
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, code, name, gender, quantity, amount, user_id, expires_at," +
        " event:events (id, title, crew_id, capacity, gender_balanced, bank_account)",
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
        amount: number;
        user_id: string | null;
        expires_at: string;
        event: {
          id: string;
          title: string;
          crew_id: string;
          capacity: number;
          gender_balanced: boolean;
          bank_account: string | null;
        };
      }
    | null;
  if (!b?.event) return;

  await Promise.all([
    guestGuide(supabase, b),
    hostSide(supabase, b),
  ]);
}

/**
 * 손님에게 입금 안내.
 *
 * **이게 없으면 21시간 동안 아무 연락이 없다.** 예매하면 24시간 안에
 * 입금해야 하는데, 그동안 가는 알림은 마감 3시간 전 한 통뿐이었다.
 * 예매하고 앱을 닫은 사람은 계좌를 다시 찾으러 들어와야 한다.
 *
 * **계좌를 알림에 적는다.** 이걸 보고 바로 은행 앱으로 넘어갈 수 있어야
 * 한다. 앱을 다시 열게 만들면 그 사이에 잊는다.
 */
async function guestGuide(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  b: {
    id: string;
    code: string;
    amount: number;
    user_id: string | null;
    expires_at: string;
    event: { title: string; bank_account: string | null };
  },
) {
  // 로그인 없이 예매한 사람은 보낼 곳이 없다. 화면의 완료 시트가 그 몫이다
  if (!b.user_id || !b.event.bank_account) return;

  const { data: subs } = await subsOf(supabase, [b.user_id]);
  if (!subs?.length) return;

  const until = new Date(b.expires_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await fan(supabase, subs as Sub[], {
    title: "입금하면 확정됩니다",
    body:
      `${b.event.title} · ${b.amount.toLocaleString("ko-KR")}원\n` +
      `${b.event.bank_account}\n` +
      `${until}까지 · 입금자명에 ${b.code} 를 넣어 주세요`,
    url: "/tickets",
    tag: `${b.id}-guide`,
  });
  await mark(supabase, b.id, "guide");
}

/**
 * 호스트에게 두 가지.
 *
 *   1. 예매가 들어왔다
 *   2. 한쪽 성별이 방금 찼다 — **이게 광고비를 아낀다.** 15/15 인
 *      파티에서 한쪽이 막히면 그때부터 그쪽 광고는 버려진다. 지금은
 *      호스트가 명단을 열어봐야 안다
 */
async function hostSide(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  b: {
    id: string;
    code: string;
    name: string;
    gender: "F" | "M";
    quantity: number;
    event: {
      id: string;
      title: string;
      crew_id: string;
      capacity: number;
      gender_balanced: boolean;
    };
  },
) {
  /**
   * 받을 사람 — 대표와 크루원.
   *
   * **user_id 가 있는 사람만.** DJ 코드는 집계용이라 계정이 안 붙어
   * 있고, 붙었더라도 손님 명단을 볼 사람이 아니다. 앱 심사용 REVIEW
   * 계정도 뺀다 — 심사자 폰을 울릴 이유가 없다.
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

  const { data: subs } = await subsOf(supabase, [...ids]);
  if (!subs?.length) return;

  const { data: stat } = await supabase
    .from("event_stats")
    .select("capacity, booked, booked_f, booked_m")
    .eq("event_id", b.event.id)
    .maybeSingle();

  const s = stat as
    | { capacity: number; booked: number; booked_f: number; booked_m: number }
    | null;
  const left = s ? s.capacity - s.booked : null;

  const who = `${b.name} · ${b.gender === "F" ? "여" : "남"} ${b.quantity}명`;
  await fan(supabase, subs as Sub[], {
    title: "예매 들어왔어요",
    body:
      `${b.event.title} · ${who}` +
      (left !== null ? `\n${left}자리 남음 · ${b.code}` : `\n${b.code}`),
    url: "/crew/manage",
    tag: `${b.id}-host`,
  });
  await mark(supabase, b.id, "host");

  // ── 성비 마감 ──────────────────────────────────────────
  if (!b.event.gender_balanced || !s) return;
  const cap = genderCap(b.event.capacity);
  const mine = b.gender === "F" ? s.booked_f : s.booked_m;
  // **방금 이 예매로 찬 경우에만.** 이미 차 있었으면 전에 보냈다
  if (mine < cap || mine - b.quantity >= cap) return;

  const label = b.gender === "F" ? "여성" : "남성";
  const other = b.gender === "F" ? "남성" : "여성";
  await fan(supabase, subs as Sub[], {
    title: `${label} 마감됐어요`,
    body:
      `${b.event.title} · 여 ${s.booked_f}/${cap} · 남 ${s.booked_m}/${cap}\n` +
      `이제 ${other}만 받습니다`,
    url: "/crew/manage",
    tag: `${b.id}-gender`,
  });
  await mark(supabase, b.id, "gender");
}
