/**
 * 크루가 적어 넣는 이미지 주소를 거른다.
 *
 * 커버·사진·아바타는 주소 문자열로 받는다. 그 주소를 나중에 **우리
 * 서버가 가서 읽는다** — OG 이미지, 티켓 스토리 이미지가 그렇다.
 * 아무 주소나 받으면 우리 서버를 시켜 남의 주소를 두드리게 할 수 있다.
 * next.config 의 remotePatterns 와 같은 목록만 통과시킨다. 우리 안의
 * 경로(/covers/…)는 그대로 둔다.
 */
const HOSTS = ["images.unsplash.com", ".supabase.co"];

export function safeImageUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v.length > 2048) return null;
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return v;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  const ok = HOSTS.some((p) => (p.startsWith(".") ? h.endsWith(p) : h === p));
  if (!ok) return null;
  if (h.endsWith(".supabase.co") && !u.pathname.startsWith("/storage/")) return null;
  return u.toString();
}
