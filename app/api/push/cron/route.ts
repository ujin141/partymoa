import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { pushReady, sendPush } from "@/lib/push";
import type { PushLogFav } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 보낼 알림을 찾아 보낸다. Vercel 크론이 30분마다 부른다.
 *
 * **누구에게 보낼지는 DB 가 고른다**(push_targets). 앱이 예매를 통째로
 * 읽어 걸러 내면 그 순간 손님 명단이 서버 밖으로 나간다.
 *
 * 같은 걸 두 번 안 보내려고 보낸 기록을 남긴다. 크론이 두 번 돌아도
 * 두 번 울리지 않는다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Target = {
  booking_id: string;
  kind: "expiring" | "today" | "paid";
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  platform: string | null;
  title: string;
  body: string;
  url: string;
};

/** 찜 알림. 예매가 없어서 booking_id 대신 user_id + event_id 로 센다 */
type Fav = {
  user_id: string;
  event_id: string;
  kind: PushLogFav["kind"];
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  platform: string | null;
  title: string;
  body: string;
  url: string;
};

export async function GET(req: Request) {
  // 크론 비밀키가 있으면 맞을 때만 돈다. 없으면 누구나 부를 수 있으니
  // 반드시 넣어야 한다
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 키가 없으면 아무나 부를 수 있는 문이 된다. 여는 대신 닫는다
    console.error("cron: CRON_SECRET 없음");
    return NextResponse.json({ message: "설정 없음" }, { status: 500 });
  }
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  // 길이가 다르면 비교 자체가 다른 시간을 쓴다. 같은 길이끼리만 재고,
  // 다른 길이는 그냥 거절
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ message: "금지" }, { status: 401 });
  }

  if (!pushReady()) {
    return NextResponse.json({ ok: false, reason: "VAPID 키 없음" });
  }

  // **서비스 롤로 부른다.** 요청에 사람이 없어서 anon 으로는
  // push_targets 도, 죽은 구독 정리도 못 한다
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY 없음" });
  }
  const { data, error } = await supabase.rpc("push_targets");
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Target[];
  let sent = 0;
  const dead: string[] = [];
  const logged = new Set<string>();

  for (const t of rows) {
    const alive = await sendPush(
      { endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth, platform: t.platform },
      { title: t.title, body: t.body, url: t.url, tag: `${t.booking_id}-${t.kind}` },
    );
    if (!alive) {
      dead.push(t.endpoint);
      continue;
    }
    sent += 1;
    const key = `${t.booking_id}|${t.kind}`;
    if (!logged.has(key)) {
      logged.add(key);
      await supabase
        .from("push_log")
        .upsert(
          { booking_id: t.booking_id, kind: t.kind },
          { onConflict: "booking_id,kind" },
        );
    }
  }

  /**
   * 찜한 파티가 얼마 안 남았을 때. **표가 따로다.**
   *
   * push_log 의 기본키가 (booking_id, kind) 인데 찜은 예매가 없다 —
   * 아직 살까 말까 하는 사람이라 booking_id 를 만들 수가 없다.
   * push_log 를 고쳐서 null 을 열면 지금 잘 돌고 있는 다섯 종류의
   * 중복 방지가 같이 흔들린다.
   *
   * **여기서 실패해도 위의 예매 알림은 이미 나갔다.** 한 덩어리로
   * 묶지 않는다.
   */
  let favSent = 0;
  try {
    const { data: favRows } = await supabase.rpc("push_targets_fav");
    for (const f of (favRows ?? []) as Fav[]) {
      const alive = await sendPush(
        { endpoint: f.endpoint, p256dh: f.p256dh, auth: f.auth, platform: f.platform },
        { title: f.title, body: f.body, url: f.url, tag: `${f.event_id}-${f.kind}` },
      );
      if (!alive) {
        dead.push(f.endpoint);
        continue;
      }
      favSent += 1;
      const key = `${f.user_id}|${f.event_id}|${f.kind}`;
      if (!logged.has(key)) {
        logged.add(key);
        await supabase
          .from("push_log_fav")
          .upsert(
            { user_id: f.user_id, event_id: f.event_id, kind: f.kind },
            { onConflict: "user_id,event_id,kind" },
          );
      }
    }
  } catch {
    /* 찜 알림이 막혀도 예매 알림은 이미 나갔다 */
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({
    ok: true,
    대상: rows.length,
    보냄: sent,
    찜: favSent,
    정리: dead.length,
  });
}
