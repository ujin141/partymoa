import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

/**
 * OG 카드용 Pretendard.
 *
 * **woff2 는 못 쓴다** — satori 가 TTF/OTF/WOFF 만 읽는다. 그래서 웹폰트와
 * 별개로 assets/og 에 TTF 를 하나 둔다. 한글 음절을 다 넣으면 2MB 라 굵기는
 * 하나만 싣고, 위계는 크기와 투명도로 만든다.
 */
let cached: Buffer | null = null;

export async function pretendard() {
  cached ??= await readFile(
    path.join(process.cwd(), "assets", "og", "Pretendard.ttf"),
  );
  return [
    {
      name: "Pretendard",
      data: cached as unknown as ArrayBuffer,
      style: "normal" as const,
      weight: 800 as const,
    },
  ];
}

export const BRAND = "#5B2BE8";
export const DEEP = "#4416C8";
export const ACCENT = "#FFE24D";
export const HOT = "#FF3B5C";
export const INK = "#16181D";

const DOTS: [number, number][] = [
  [63.2, 63.25],
  [51.32, 72.66],
  [36.53, 71.19],
  [26.6, 59.63],
  [26.6, 40.37],
  [36.53, 28.81],
  [51.32, 27.34],
  [63.2, 36.75],
];

/**
 * 심볼. 열린 원 + 바깥의 점 하나 — 좌표를 손대지 말 것.
 *
 * **원이 닫혀 있지 않은 게 핵심이다**(사양서 2절). 혼자 온 사람이
 * 들어갈 자리를 형태로 말한다. 그래서 카드에서도 구석의 로고가 아니라
 * 큰 도형으로 쓴다.
 */
export function Mark({
  size = 64,
  dot = "#FFFFFF",
  accent = ACCENT,
  opacity = 1,
}: {
  size?: number;
  dot?: string;
  accent?: string;
  opacity?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }}>
      {DOTS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={8.2} fill={dot} />
      ))}
      <circle cx={85} cy={50} r={10.17} fill={accent} />
    </svg>
  );
}

/** 워드마크. 어두운 바닥에서는 '모아' 가 노랑이다 */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.42 }}>
      <Mark size={size * 1.25} />
      <div style={{ display: "flex", fontSize: size, letterSpacing: -1 }}>
        <span style={{ color: "#fff" }}>파티</span>
        <span style={{ color: ACCENT }}>모아</span>
      </div>
    </div>
  );
}
