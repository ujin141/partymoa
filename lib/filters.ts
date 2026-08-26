import { seoulWeekday } from "@/lib/format";
import type { PartyCardData } from "@/lib/queries";

/**
 * 둘러보기 필터.
 *
 * **갈래와 필터는 다른 물건이다.** 갈래는 "어떤 파티인가" 를 하나
 * 고르는 것이고, 필터는 그 안에서 조건을 겹쳐 좁히는 것이다. 그래서
 * 갈래는 하나만 켜지고 필터는 여러 개가 같이 켜진다.
 *
 * 여기 값들은 전부 **주소창에 남는다.** 링크를 복사해 보내면 상대도
 * 같은 목록을 본다 — 크루가 "이 링크로 들어와" 라고 쓸 수 있어야 한다.
 */

export type FilterKey =
  | "area"
  | "date"
  | "age"
  | "rel"
  | "music"
  | "crowd"
  | "price";

export interface FilterDef {
  key: FilterKey;
  icon: string;
  label: string;
  options: { value: string; label: string }[];
}

/** 음악은 값이 곧 태그다. 크루가 적은 장르를 그대로 쓴다 */
const MUSIC = [
  "하우스",
  "테크노",
  "힙합",
  "EDM",
  "디스코",
  "R&B",
  "K-POP",
];

export const FILTERS: FilterDef[] = [
  {
    key: "date",
    icon: "📅",
    label: "날짜",
    options: [
      { value: "today", label: "오늘" },
      { value: "weekend", label: "이번 주말" },
      { value: "week", label: "7일 안" },
      { value: "month", label: "이번 달" },
    ],
  },
  {
    key: "rel",
    icon: "❤️",
    label: "솔로/커플",
    options: [
      { value: "solo", label: "혼자 가도 되는" },
      { value: "couple", label: "커플 환영" },
    ],
  },
  {
    key: "age",
    icon: "👥",
    label: "연령대",
    options: [
      { value: "early20", label: "20대 초반" },
      { value: "late20", label: "20대 후반" },
      { value: "30", label: "30대 이상" },
    ],
  },
  {
    key: "music",
    icon: "🎧",
    label: "음악",
    options: MUSIC.map((m) => ({ value: m, label: m })),
  },
  {
    key: "crowd",
    icon: "🌎",
    label: "한국인/외국인",
    options: [
      { value: "korean", label: "한국인 위주" },
      { value: "mixed", label: "반반" },
      { value: "global", label: "외국인 많음" },
    ],
  },
  {
    key: "price",
    icon: "💰",
    label: "가격",
    options: [
      { value: "under3", label: "3만원 미만" },
      { value: "3to5", label: "3~5만원" },
      { value: "5to7", label: "5~7만원" },
      { value: "over7", label: "7만원 이상" },
    ],
  },
];

export const filterByKey = (k: string) =>
  FILTERS.find((f) => f.key === k) ?? null;

/** 날짜 판정은 전부 서울 기준. UTC 서버에서 재면 토요일 새벽이 금요일로 밀린다 */
function days(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 86400000;
}

function matchDate(v: string, iso: string) {
  const d = days(iso);
  if (d < 0) return false;
  if (v === "today") {
    const seoul = (x: string | number | Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(x));
    return seoul(iso) === seoul(Date.now());
  }
  if (v === "weekend") {
    const w = seoulWeekday(iso);
    return d <= 7 && (w === 5 || w === 6);
  }
  if (v === "week") return d <= 7;
  if (v === "month") return d <= 31;
  return true;
}

function matchAge(v: string, e: PartyCardData["event"]) {
  const lo = e.age_min ?? 0;
  const hi = e.age_max ?? 99;
  // 겹치기만 하면 통과다. "20대 초반" 을 고른 사람에게 23~29 짜리
  // 파티를 숨기면 볼 게 없어진다
  if (v === "early20") return lo <= 24 && hi >= 20;
  if (v === "late20") return lo <= 29 && hi >= 25;
  if (v === "30") return hi >= 30;
  return true;
}

function matchPrice(v: string, d: PartyCardData) {
  const p = d.tier?.price ?? d.event.list_price ?? 0;
  if (!p) return true;
  if (v === "under3") return p < 30000;
  if (v === "3to5") return p >= 30000 && p < 50000;
  if (v === "5to7") return p >= 50000 && p < 70000;
  if (v === "over7") return p >= 70000;
  return true;
}

/** 켜져 있는 필터를 전부 통과해야 남는다 */
export function passesFilters(
  d: PartyCardData,
  on: Partial<Record<FilterKey, string>>,
) {
  const e = d.event;

  if (on.area && on.area !== "전체" && e.area !== on.area) return false;
  if (on.date && !matchDate(on.date, e.starts_at)) return false;
  if (on.age && !matchAge(on.age, e)) return false;

  if (on.rel === "solo" && !e.solo_friendly) return false;
  if (on.rel === "couple" && !e.couple_friendly) return false;

  if (on.music) {
    const mine = [...e.genres, ...e.categories].map((t) =>
      t.trim().toLowerCase(),
    );
    if (!mine.includes(on.music.toLowerCase())) return false;
  }

  // 안 적어 둔 파티는 거르지 않는다. 크루가 값을 안 넣었다고 목록에서
  // 사라지면 그건 크루에게 벌을 주는 것이다
  if (on.crowd && e.crowd && e.crowd !== on.crowd) return false;

  if (on.price && !matchPrice(on.price, d)) return false;

  return true;
}
