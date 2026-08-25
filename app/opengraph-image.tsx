import { ImageResponse } from "next/og";

import {
  ACCENT,
  BRAND,
  DEEP,
  Mark,
  OG_SIZE,
  OG_TYPE,
  pretendard,
} from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "파티모아 — 서울 언더그라운드 파티 사전예매";

/**
 * 서비스 링크를 던졌을 때 뜨는 카드.
 *
 * 파티별 카드와 같은 구조를 쓴다 — 바이올렛 바닥, 왼쪽 글자, 오른쪽에
 * 큰 열린 원. 두 카드가 나란히 떴을 때 한 서비스로 보여야 한다.
 */
export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `linear-gradient(135deg, ${BRAND} 0%, ${DEEP} 100%)`,
          fontFamily: "Pretendard",
          color: "#fff",
        }}
      >
        <div
          style={{ position: "absolute", left: 700, top: 130, display: "flex" }}
        >
          <Mark size={380} opacity={0.16} />
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 72px",
            width: 760,
          }}
        >
          <Mark size={72} />
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 86,
              letterSpacing: -3.5,
            }}
          >
            <span>파티</span>
            <span style={{ color: ACCENT }}>모아</span>
          </div>
          <div style={{ marginTop: 20, fontSize: 30, opacity: 0.86 }}>
            서울 언더그라운드 파티, 한 곳에서
          </div>
          <div style={{ marginTop: 10, fontSize: 24, opacity: 0.6 }}>
            혼자 와도 되는 자리를 찾습니다
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await pretendard() },
  );
}
