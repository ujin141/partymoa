import type { EventRow } from "@/types/database";

/**
 * 파티를 여섯 갈래로 나눈다.
 *
 * **태그를 나열하는 것과 갈래를 정하는 것은 다르다.** 지금까지는
 * 하우스·테크노·루프탑·1인 참여가 한 줄에 뒤섞여 있었다. 그 줄은
 * 이미 뭘 찾는지 아는 사람에게만 쓸모가 있다. 처음 온 사람은
 * "테크노" 와 "루프탑" 중에 뭘 눌러야 자기가 갈 만한 파티가 나오는지
 * 모른다.
 *
 * 갈래는 **가는 이유**로 나눈다. 무슨 음악이 나오는지는 그다음이다.
 *
 * 태그는 크루가 자유롭게 적는다. 그래서 여기서 **태그를 갈래에 끌어다
 * 붙인다** — 크루에게 우리 분류를 외우게 하지 않는다.
 */
export interface Genre {
  key: string;
  /** 화면에 붙는 그림 문자. 여섯 개가 한눈에 갈라져 보이게 하는 것이 일이다 */
  icon: string;
  label: string;
  note: string;
  /** 이 갈래로 치는 태그. 전부 소문자로 비교한다 */
  tags: string[];
}

export const GENRES: Genre[] = [
  {
    key: "social",
    icon: "❤️",
    label: "소셜/솔로",
    note: "혼자 가도 되는 자리",
    tags: [
      "솔로파티",
      "솔로",
      "소개팅",
      "미팅",
      "헌팅",
      "네트워킹",
      "소셜",
      "1인 참여",
      "1인",
    ],
  },
  {
    key: "club",
    icon: "🎧",
    label: "클럽/DJ",
    note: "라인업 보고 가는 파티",
    tags: [
      "클럽",
      "dj",
      "디제이",
      "하우스",
      "테크노",
      "일렉",
      "edm",
      "힙합",
      "디스코",
      "레이브",
      "언더그라운드",
      "house",
      "techno",
      "club",
    ],
  },
  {
    key: "pool",
    icon: "🏖️",
    label: "풀/루프탑",
    note: "물과 야외",
    tags: [
      "풀파티",
      "풀",
      "수영장",
      "루프탑",
      "야외",
      "비치",
      "워터",
      "pool",
      "rooftop",
    ],
  },
  {
    key: "bar",
    icon: "🍸",
    label: "술/라운지",
    note: "앉아서 마시는 자리",
    tags: [
      "라운지",
      "바",
      "칵테일",
      "와인",
      "위스키",
      "샴페인",
      "포차",
      "술",
      "bar",
      "lounge",
    ],
  },
  {
    key: "global",
    icon: "🌎",
    label: "글로벌",
    note: "외국인도 많은 자리",
    tags: [
      "글로벌",
      "외국인",
      "인터내셔널",
      "랭귀지",
      "영어",
      "global",
      "international",
    ],
  },
  {
    key: "hobby",
    icon: "🎨",
    label: "취미/모임",
    note: "같이 뭘 하는 모임",
    tags: [
      "취미",
      "모임",
      "원데이",
      "클래스",
      "보드게임",
      "러닝",
      "등산",
      "독서",
      "전시",
      "워크숍",
    ],
  },
];

export const genreByKey = (key?: string | null) =>
  GENRES.find((g) => g.key === key) ?? null;

/**
 * 이 파티가 그 갈래에 드는가.
 *
 * 태그를 먼저 보고, **크루가 체크해 둔 값도 같이 친다.** "1인 참여
 * 환영" 을 켜 놓고 태그에는 안 적는 경우가 많은데, 그 체크가 곧 그
 * 갈래의 뜻이다. 글로벌도 마찬가지다.
 */
export function inGenre(g: Genre, e: EventRow) {
  if (g.key === "social" && e.solo_friendly) return true;
  if (g.key === "global" && e.crowd === "global") return true;
  const mine = [...e.categories, ...e.genres].map((t) =>
    t.trim().toLowerCase(),
  );
  return g.tags.some((t) => mine.includes(t));
}
