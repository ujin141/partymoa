import { ImageResponse } from "next/og";

import { BRAND, DEEP, Mark, OG_SIZE, OG_TYPE, pretendard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "파티모아 — 서울 언더그라운드 파티 사전예매";

/** 카톡·인스타에 서비스 링크를 던졌을 때 뜨는 카드 */
export default async function OG() {
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
          background: `linear-gradient(135deg, ${BRAND} 0%, ${DEEP} 100%)`,
          color: "#fff",
          fontFamily: "Pretendard",
        }}
      >
        <Mark size={150} />
        <div style={{ marginTop: 34, fontSize: 78, letterSpacing: -3 }}>
          파티모아
        </div>
        <div style={{ marginTop: 16, fontSize: 28, opacity: 0.8 }}>
          서울 언더그라운드 파티, 한 곳에서
        </div>
      </div>
    ),
    { ...size, fonts: await pretendard() },
  );
}
