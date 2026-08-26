"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { nightNow } from "@/lib/night";
import { pushReady, sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 광고성 푸시 보내기.
 *
 * 네 가지를 지킨다.
 *
 *   1. **동의한 사람에게만.** marketing_targets 가 골라 준다
 *   2. **제목에 (광고) 를 붙인다.** 법이 광고임을 밝히라고 한다
 *   3. **밤에는 안 보낸다.** 21시~8시는 별도 동의가 필요한데 안 받았다
 *   4. **보낸 기록을 남긴다.** 수신거부 분쟁에서 이게 근거다
 */
export async function sendMarketing(input: {
  title: string;
  body: string;
  url?: string;
}) {
  const admin = await requireAdmin();

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    return { ok: false as const, message: "제목과 내용을 적어 주세요." };
  }
  if (!pushReady()) {
    return { ok: false as const, message: "VAPID 키가 없어요." };
  }
  if (nightNow()) {
    return {
      ok: false as const,
      message:
        "밤 9시부터 아침 8시까지는 광고를 보낼 수 없어요. 야간 광고는 별도 동의를 받아야 합니다.",
    };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return { ok: false as const, message: "SUPABASE_SERVICE_ROLE_KEY 가 없어요." };
  }

  const { data, error } = await supabase.rpc("marketing_targets");
  if (error) return { ok: false as const, message: error.message };

  const rows = (data ?? []) as {
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];

  const url = input.url?.trim() || "/";
  let sent = 0;
  const dead: string[] = [];

  for (const t of rows) {
    const alive = await sendPush(t, {
      // 광고임을 제목에서 바로 알 수 있어야 한다
      title: `(광고) ${title}`,
      body: `${body}\n\n수신거부: 마이 > 알림`,
      url,
      tag: "partymoa-ad",
    });
    if (alive) sent += 1;
    else dead.push(t.endpoint);
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  await supabase.from("marketing_log").insert({
    title,
    body,
    url,
    sent_by: admin.id,
    targets: rows.length,
    sent,
  });

  revalidatePath("/admin/push");
  return { ok: true as const, targets: rows.length, sent, dead: dead.length };
}
