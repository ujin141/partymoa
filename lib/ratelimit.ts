import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
    // **service_role 로 부른다.** rate_ok 는 이제 손님(anon)이 못 부른다 —
    // 버킷 이름을 마음대로 넣어 남을 잠그거나 표를 채울 수 있어서 막았다.
    // 서버 라우트만 세면 되니 여기서만 service_role 을 쓴다
    const supabase = createAdminClient();
    // 키가 없는 환경(로컬)이면 못 센다. 막지 않고 통과시킨다
    if (!supabase) return true;
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
