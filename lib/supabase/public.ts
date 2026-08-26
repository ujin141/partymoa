import "server-only";

import { createClient as createSupabase } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * 쿠키를 안 보는 공개 클라이언트.
 *
 * **캐시할 수 있는 읽기 전용이다.** unstable_cache 안에서는 쿠키를 못
 * 읽는다 — 읽는 순간 그 결과가 사람마다 달라져서 캐시가 성립하지 않는다.
 * 목록·잔여 같은 값은 누가 보든 같으므로 여기로 읽고 캐시에 얹는다.
 *
 * 익명 키라 RLS 는 그대로 걸린다. 공개된 파티만 나온다.
 */
let client: ReturnType<typeof createSupabase<Database>> | null = null;

export function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE 환경변수가 없습니다.");
  client ??= createSupabase<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
