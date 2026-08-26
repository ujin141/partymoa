import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * 환경변수를 읽고, 없으면 **무엇이 없는지 말하고** 멈춘다.
 * `!` 로 넘기면 supabase-js 안쪽에서 "Invalid URL" 같은 말로 터져서
 * 배포 로그만 보고는 원인을 못 찾는다.
 */
function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다. " +
        "Vercel 프로젝트 환경변수를 확인하세요.",
    );
  }
  return { url, key };
}

/** 서버 컴포넌트·라우트 핸들러용. 요청마다 새로 만든다. */
export async function createClient() {
  const { url, key } = env();
  const store = await cookies();
  return createServerClient<Database>(
    url,
    key,
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

// 서비스 롤 클라이언트는 두지 않는다. RLS 를 통째로 우회하는 통로라,
// 쓰는 곳이 하나도 없는데 놀려 두면 언젠가 아무 생각 없이 import 된다.
// 정말 필요해지면 그때 만들고 쓰는 자리를 함께 적는다.
