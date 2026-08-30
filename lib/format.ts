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

/**
 * 연락처를 010-1234-5678 로 통일해서 보여준다.
 *
 * 명단에 하이픈이 있는 번호와 없는 번호가 섞여 있다 — 앱으로 들어온 건은
 * 손님이 친 대로, SQL 로 넣은 건은 적은 대로 저장됐기 때문이다. 눈으로
 * 훑을 때 자릿수가 안 맞으면 그때부터 번호를 못 읽는다.
 *
 * **저장된 값을 바꾸지 않는다.** 보여줄 때만 맞춘다 — 검색은 이미
 * 숫자만 뽑아 비교하므로 어느 쪽이든 걸린다.
 */
/**
 * 칠 때마다 모양을 맞춘다.
 *
 * **저장할 때가 아니라 치는 동안 맞춘다.** 나중에 고치면 손님은 자기가
 * 친 것과 다른 값이 저장된 걸 모르고, 크루는 010-1234-5678 과
 * 01012345678 을 다른 사람으로 본다.
 *
 * 외국 번호(+)는 안 건드린다 — 나라마다 자릿수가 달라서 우리가 아는
 * 모양으로 끊으면 오히려 틀린다.
 */
export function phoneMask(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/[^0-9]/g, "");

  const d = t.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

/**
 * 연락이 닿을 번호인가.
 *
 * **이게 없으면 아무 글자나 통과한다.** 예매는 필수 입력이었지만
 * 내용을 안 봤다 — 'ㅁㄴㅇㄹ' 로도 자리가 잡혔고, 그러면 호스트가
 * 입금을 확인하려 해도 연락할 데가 없다.
 *
 * 외국 손님을 막지 않는다. 압구정·이태원 파티에 +81, +1 로 적는
 * 사람이 실제로 온다 — 010 만 받으면 그 사람들은 예매를 못 한다.
 */
export function phoneOk(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (t.startsWith("+")) {
    const d = t.slice(1).replace(/\D/g, "");
    return d.length >= 8 && d.length <= 15;
  }
  const d = t.replace(/\D/g, "");
  // 휴대폰 10~11 자리와 서울 지역번호까지. 0 으로 시작하지 않으면 번호가 아니다
  return /^0\d{8,10}$/.test(d);
}

export function phoneText(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    // 02 는 지역번호가 두 자리다. 011·016 같은 옛 번호는 세 자리
    return d.startsWith("02")
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw ?? "";
}
