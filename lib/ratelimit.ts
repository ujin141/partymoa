import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * 요청 제한.
 *
 * **Vercel 함수는 요청마다 새로 뜬다.** 메모리에 세어 두면 다음 요청은
 * 다른 인스턴스로 가서 0부터 다시 센다 — 아무것도 못 막는다. 세는
 * 자리는 DB 한 곳이어야 한다.
 *
 * 쓰기에만 건다. 읽기까지 걸면 왕복이 늘어 오히려 느려진다.
 */
export async function limit(
  bucket: string,
  max: number,
  seconds: number,
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rate_ok", {
      p_bucket: bucket,
      p_limit: max,
      p_seconds: seconds,
    });
    // **막는 쪽이 아니라 통과시키는 쪽으로 실패한다.** 제한 장치가
    // 고장 났다고 예매가 막히면 그게 더 큰 사고다
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** 요청을 보낸 쪽. Vercel 뒤에서는 x-forwarded-for 가 진짜다 */
export function who(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim();
  return ip || req.headers.get("x-real-ip") || "unknown";
}
