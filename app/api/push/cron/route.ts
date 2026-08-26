import { NextResponse } from "next/server";

import { pushReady, sendPush } from "@/lib/push";
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

export async function GET(req: Request) {
  // 크론 비밀키가 있으면 맞을 때만 돈다. 없으면 누구나 부를 수 있으니
  // 반드시 넣어야 한다
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = req.headers.get("authorization");
    if (got !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "금지" }, { status: 401 });
    }
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

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({ ok: true, 대상: rows.length, 보냄: sent, 정리: dead.length });
}
