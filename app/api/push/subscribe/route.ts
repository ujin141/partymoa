import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * 푸시 구독 저장·해지.
 *
 * endpoint 가 키다. 같은 기기가 다시 구독하면 줄이 안 늘어난다.
 * **익명 세션도 받는다** — 로그인 없이 예매하는 앱이라 그 사람들이야말로
 * 입금 마감 알림이 제일 필요하다.
 */
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
    return NextResponse.json({ message: error.message }, { status: 500 });
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
