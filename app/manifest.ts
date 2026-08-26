import type { MetadataRoute } from "next";

/** 홈 화면에 추가했을 때. 클럽 손님은 폰에서만 들어온다 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "파티모아",
    short_name: "파티모아",
    description: "서울 언더그라운드 파티를 한 곳에서. 사전예매 플랫폼.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#5B2BE8",
    lang: "ko",
    orientation: "portrait",
    icons: [
      { src: "/appicon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/appicon.png", sizes: "512x512", type: "image/png" },
      /**
       * **마스커블은 모서리가 없는 판이어야 한다.** appicon.png 는
       * 둥근 모서리가 이미 그려져 있고 바깥이 투명하다. 안드로이드가
       * 거기에 또 마스크를 씌우면 둥근 모서리 안에 둥근 모서리가
       * 생기고 가장자리가 비어 보인다. 그래서 꽉 찬 정사각 판을
       * 따로 둔다 — Play 아이콘으로 쓰는 것과 같은 그림이다.
       */
      {
        src: "/appicon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
