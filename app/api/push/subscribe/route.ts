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
  } | null;

  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
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
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
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
  const { endpoint } = (await req.json().catch(() => ({}))) as {
    endpoint?: string;
  };
  if (!endpoint) {
    return NextResponse.json({ message: "endpoint 가 없어요." }, { status: 400 });
  }
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
