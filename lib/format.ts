export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * **시간은 전부 서울 기준으로 찍는다.**
 *
 * `new Date(iso).getHours()` 는 **그 코드가 도는 기계의 시간대**를 쓴다.
 * 로컬 윈도우는 KST 라 맞게 보이지만, Vercel 서버는 UTC 라 19:00 행사가
 * 10:00 으로 나갔다. 손님이 보는 시간이 아홉 시간 틀리는 것이라 예매가
 * 아니라 사고다.
 *
 * 한국 파티만 다루는 서비스이므로 시대를 고정한다 — 나중에 해외 행사를
 * 올릴 일이 생기면 events 에 시간대 컬럼을 두고 여기로 넘긴다.
 */
const SEOUL = "Asia/Seoul";

type Parts = {
  y: number;
  m: number;
  d: number;
  H: number;
  M: number;
  w: string;
};

const FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
});

function seoul(iso: string): Parts {
  const got: Record<string, string> = {};
  for (const p of FMT.formatToParts(new Date(iso))) got[p.type] = p.value;
  return {
    y: Number(got.year),
    m: Number(got.month),
    d: Number(got.day),
    // 24시간 표기에서 자정을 "24" 로 주는 구현이 있다. 0 으로 맞춘다
    H: Number(got.hour) % 24,
    M: Number(got.minute),
    w: got.weekday ?? "",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 8월 22일 토요일 */
export function longDate(iso: string) {
  const t = seoul(iso);
  return `${t.m}월 ${t.d}일 ${t.w}요일`;
}

/** 8/22 (토) */
export function shortDate(iso: string) {
  const t = seoul(iso);
  return `${t.m}/${t.d} (${t.w})`;
}

/** 19:00 — 24:00. 자정을 넘기면 24, 25 로 이어 적는다 (클럽 표기) */
export function timeRange(startIso: string, endIso: string) {
  const s = seoul(startIso);
  const e = seoul(endIso);
  const crosses = e.d !== s.d || e.m !== s.m || e.y !== s.y;
  const endH = crosses ? e.H + 24 : e.H;
  return `${pad(s.H)}:${pad(s.M)} — ${endH}:${pad(e.M)}`;
}

/** 8/29 19:30 — 명단·정산처럼 날짜와 시각이 같이 필요한 자리 */
export function stamp(iso: string) {
  const t = seoul(iso);
  return `${t.m}/${t.d} ${pad(t.H)}:${pad(t.M)}`;
}

/** 2026-08-29 19:30 — CSV 처럼 정렬해서 볼 자리 */
export function stampFull(iso: string) {
  const t = seoul(iso);
  return `${t.y}-${pad(t.m)}-${pad(t.d)} ${pad(t.H)}:${pad(t.M)}`;
}

/** 그 시각이 서울 기준으로 무슨 요일인가 (0=일) */
export function seoulWeekday(iso: string) {
  return ["일", "월", "화", "수", "목", "금", "토"].indexOf(seoul(iso).w);
}

/** `datetime-local` 입력이 쓰는 서울 기준 문자열 */
export function toLocalInput(iso: string) {
  const t = seoul(iso);
  return `${t.y}-${pad(t.m)}-${pad(t.d)}T${pad(t.H)}:${pad(t.M)}`;
}

/**
 * `datetime-local` 이 준 문자열("2026-08-29T19:00")을 **서울 시각으로 읽어**
 * ISO 로 바꾼다.
 *
 * `new Date("2026-08-29T19:00")` 은 시대가 없어서 **그 코드가 도는 기계의
 * 시간대**로 해석된다. 서버 액션은 Vercel 에서 도니까 UTC 로 읽혀 저장이
 * 아홉 시간 밀린다 — 크루가 19시로 적은 행사가 새벽 4시로 들어간다.
 */
export function fromSeoulInput(local: string) {
  const t = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return null;
  const d = new Date(`${t.slice(0, 16)}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 예매번호는 PM0001 형식 (사양서 4-6) */
export const isBookingCode = (s: string) => /^PM\d{4,}$/i.test(s.trim());

/** 방금 · 3분 전 · 2시간 전 · 8/26. 게시판은 절대 시각보다 이게 읽힌다 */
export function ago(iso: string) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`;
  const t = seoul(iso);
  return `${t.m}/${t.d}`;
}
