import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** 서버 컴포넌트·라우트 핸들러용. 요청마다 새로 만든다. */
export async function createClient() {
  const store = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 못 쓴다. 미들웨어가 갱신하므로 무시한다
          }
        },
      },
    },
  );
}

/**
 * 서비스 롤 클라이언트. **RLS 를 우회한다** — 크루 관리자 조회처럼
 * 서버에서만 도는 코드에서만 쓰고, 클라이언트 번들에 새어 나가면 안 된다.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다");
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
