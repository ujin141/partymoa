import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "파티모아 — 서울 언더그라운드 파티 사전예매";

/** 카톡·인스타에 링크를 던졌을 때 뜨는 카드. 심볼과 워드마크만 */
export default function OG() {
  const dots: [number, number][] = [
    [63.2, 63.25],
    [51.32, 72.66],
    [36.53, 71.19],
    [26.6, 59.63],
    [26.6, 40.37],
    [36.53, 28.81],
    [51.32, 27.34],
    [63.2, 36.75],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5B2BE8 0%, #4416C8 100%)",
          color: "#fff",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 100 100">
          {dots.map(([cx, cy]) => (
            <circle key={`${cx}`} cx={cx} cy={cy} r={8.2} fill="#FFFFFF" />
          ))}
          <circle cx={85} cy={50} r={10.17} fill="#FFE24D" />
        </svg>
        <div
          style={{
            marginTop: 34,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -3,
          }}
        >
          파티모아
        </div>
        <div style={{ marginTop: 14, fontSize: 28, opacity: 0.82 }}>
          서울 언더그라운드 파티, 한 곳에서
        </div>
      </div>
    ),
    size,
  );
}
