import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * 푸시 구독 저장·해지.
 *
 * endpoint 가 키다. 같은 기기가 다시 구독하면 줄이 안 늘어난다.
 * **익명 세션도 받는다** — 로그인 없이 예매하는 앱이라 그 사람들이야말로
 * 입금 마감 알림이 제일 필요하다.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "web.push.apple.com",
  ".push.apple.com",
  "updates.push.services.mozilla.com",
  ".notify.windows.com",
  ".push.samsungosp.com",
  "push-api.cloud.huawei.com",
];

function endpointOk(endpoint: string, ios: boolean): boolean {
  if (ios) return /^[0-9a-f]{64}$/i.test(endpoint);
  if (endpoint.length > 1024) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTS.some((p) =>
    p.startsWith(".") ? h === p.slice(1) || h.endsWith(p) : h === p,
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    platform?: string;
  } | null;

  // 아이폰 앱은 endpoint 자리에 APNs 디바이스 토큰만 온다. 암호화 키가 없다
  const ios = body?.platform === "ios";

  if (!body?.endpoint || (!ios && (!body.keys?.p256dh || !body.keys?.auth))) {
    return NextResponse.json({ message: "구독 정보가 없어요." }, { status: 400 });
  }
  /**
   * **주소 모양을 본다.** endpoint 는 나중에 우리 서버가 POST 를 보내는
   * 곳이다. 아무 주소나 받아 두면 광고 발송 때마다 그 주소로 요청이
   * 나간다 — 남의 서버를 두드리는 데 우리 서버를 빌려주는 꼴이다.
   * 푸시 서비스 호스트만 받는다. 아이폰 토큰은 64자리 16진수다.
   */
  if (!endpointOk(body.endpoint, ios)) {
    // 호스트만 남긴다. 어느 브라우저를 빠뜨렸는지 여기서 보인다
    let host = "?";
    try { host = new URL(body.endpoint).hostname; } catch { /* 주소가 아니다 */ }
    console.warn("push: 허용 밖 호스트", ios ? "ios-token" : host);
    return NextResponse.json({ message: "구독 주소가 올바르지 않아요." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "세션이 없어요." }, { status: 401 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: body.endpoint,
      user_id: user.id,
      p256dh: ios ? null : body.keys!.p256dh!,
      auth: ios ? null : body.keys!.auth!,
      platform: ios ? "ios" : "web",
      failed_at: null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    // 한 계정 5줄 제한(DB 트리거)에 걸렸다
    if (/RATE/.test(error.message ?? "")) {
      return NextResponse.json({ message: "기기가 너무 많아요. 안 쓰는 기기에서 알림을 꺼 주세요." }, { status: 429 });
    }
    console.error("push subscribe", error.code, error.message);
    return NextResponse.json({ message: "알림 설정을 저장하지 못했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint, platform } = (await req.json().catch(() => ({}))) as {
    endpoint?: string;
    platform?: string;
  };
  const supabase = await createClient();

  // 아이폰 앱은 디바이스 토큰을 들고 있지 않다. 내 iOS 기기 행을 통째로 지운다.
  // RLS(push_own)가 본인 것만 지우게 막아 준다
  if (!endpoint && platform === "ios") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "세션이 없어요." }, { status: 401 });
    }
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", "ios");
    return NextResponse.json({ ok: true });
  }

  if (!endpoint) {
    return NextResponse.json({ message: "endpoint 가 없어요." }, { status: 400 });
  }
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
