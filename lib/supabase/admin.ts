import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * **RLS 를 통째로 우회한다.** 쓰는 자리를 여기 적어 두고, 그 밖에서는
 * import 하지 않는다.
 *
 *   app/api/push/cron/route.ts   크론이 부른다. 요청에 사람이 없다
 *   app/(crew)/crew/actions.ts   입금 확인 알림. 손님 구독을 읽어야 한다
 *
 * ## 왜 필요한가
 *
 * 푸시는 **남의 행을 건드리는 유일한 기능**이다.
 *
 *   · push_subscriptions 정책은 "본인 것만" 이다. 맞는 정책이다 —
 *     남의 endpoint 를 알면 그 기기로 알림을 보낼 수 있다.
 *     그런데 알림을 보내려면 바로 그 남의 행을 읽어야 한다
 *   · 크론에는 로그인한 사람이 없다. anon 으로는 push_targets 를
 *     부를 수 없고, 부를 수 있게 열면 손님 endpoint 가 공개된다
 *
 * 정책을 느슨하게 푸는 대신 **한 통로만 뚫고 그 통로를 좁게 쓴다.**
 *
 * 키가 없으면 null 을 돌려준다. 알림은 곁다리라, 키를 안 넣었다고
 * 입금 확인 같은 진짜 일이 막히면 안 된다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
