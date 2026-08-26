/**
 * 밤에는 광고를 안 보낸다. 정보통신망법 50조 3항 — 21시부터 다음날 8시.
 *
 * `"use server"` 파일에는 async 가 아닌 export 를 둘 수 없어서 여기 있다.
 * 서버·클라이언트 양쪽에서 쓴다.
 */
export function nightNow(now = new Date()): boolean {
  const h = Number(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return h >= 21 || h < 8;
}
