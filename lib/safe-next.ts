/**
 * 로그인 뒤 돌아갈 주소를 거른다.
 *
 * `next=//evil.com` 을 `new URL(next, origin)` 에 넣으면 우리 도메인이
 * 아니라 evil.com 이 된다. 로그인 직후에 밖으로 튕기는 문이라 피싱에
 * 딱 좋다. **우리 안의 경로만 통과시킨다** — 슬래시 하나로 시작하고,
 * 두 번째 글자가 슬래시나 역슬래시가 아니어야 한다.
 */
export function safeNext(raw: string | null | undefined, fallback: string) {
  const v = (raw ?? "").trim();
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  // 스킴을 숨긴 형태(/\t/evil, /%2F...) 도 막는다
  if (/[\x00-\x1f]/.test(v) || /^\/%2f/i.test(v) || /^\/%5c/i.test(v)) return fallback;
  return v;
}
