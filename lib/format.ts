export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 8월 22일 토요일 */
export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

/** 8/22 (토) */
export function shortDate(iso: string) {
  const d = new Date(iso);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${w})`;
}

/** 17:00 — 24:00. 자정을 넘기면 24, 25 로 이어 적는다 (클럽 표기) */
export function timeRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const crosses = e.getDate() !== s.getDate();
  const endH = crosses ? e.getHours() + 24 : e.getHours();
  const end = crosses
    ? `${endH}:${String(e.getMinutes()).padStart(2, "0")}`
    : hm(e);
  return `${hm(s)} — ${end}`;
}

/** 예매번호는 PM0001 형식 (사양서 4-6) */
export const isBookingCode = (s: string) => /^PM\d{4,}$/i.test(s.trim());

/** 방금 · 3분 전 · 2시간 전 · 8/26. 게시판은 절대 시각보다 이게 읽힌다 */
export function ago(iso: string) {
  const d = new Date(iso);
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
