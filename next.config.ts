import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉터리에 다른 lockfile 이 있어 Next 가 루트를 잘못 잡는다.
  // pathname 을 직접 자르면 맥에서 앞 슬래시가 날아가 상대경로가 된다 — fileURLToPath 를 쓴다
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  // OG 카드가 fs 로 읽는 폰트다. 이걸 안 적으면 Vercel 번들에서 빠져
  // 배포 후에만 "파일 없음" 으로 터진다 — 로컬에서는 멀쩡하다
  outputFileTracingIncludes: {
    // 라우트 이름에 해시 접미사가 붙는다 (opengraph-image-1jkstu). 글로브로 잡는다
    "/opengraph-image*": ["./assets/og/**"],
    "/party/[slug]/opengraph-image*": ["./assets/og/**"],
    // 스토리 티켓 이미지도 같은 폰트를 fs 로 읽는다
    "/tickets/[code]/story": ["./assets/og/**"],
  },
  // 응답 본문을 줄인다. 텍스트가 대부분이라 잘 줄어든다
  compress: true,
  // 헤더에 프레임워크 버전을 광고하지 않는다
  poweredByHeader: false,

  /**
   * **같은 사진을 두 번 내려받게 하지 않는다.**
   *
   * 커버·파티 사진은 파일 이름이 바뀌지 않으면 내용도 안 바뀐다.
   * 기본 캐시는 짧아서 방문할 때마다 다시 받아 가고, 그게 그대로
   * 전송 비용이 된다. 1년으로 잡고, 바꿀 일이 생기면 파일 이름을
   * 바꾼다(after-sunset.jpg → after-sunset-2.jpg).
   */
  async headers() {
    const YEAR = "public, max-age=31536000, immutable";
    return [
      { source: "/covers/:path*", headers: [{ key: "cache-control", value: YEAR }] },
      { source: "/photos/:path*", headers: [{ key: "cache-control", value: YEAR }] },
      { source: "/fonts/:path*", headers: [{ key: "cache-control", value: YEAR }] },
      { source: "/appicon.png", headers: [{ key: "cache-control", value: YEAR }] },
      {
        // 서비스 워커는 캐시하면 안 된다. 새 버전을 못 받는다
        source: "/sw.js",
        headers: [{ key: "cache-control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },

  images: {
    // 다시 만든 이미지를 1년간 들고 있는다. 리사이즈는 비싸다
    minimumCacheTTL: 31536000,
    // 폰 폭(430px) 앱이다. 큰 규격을 만들 이유가 없다
    deviceSizes: [360, 430, 640, 860, 1080],
    imageSizes: [64, 78, 96, 168, 256],
    formats: ["image/avif", "image/webp"],
    // 커버는 크루가 주소로 넣는다. 아무 호스트나 열면 우리 서버가
    // 남의 이미지 리사이저가 되므로 쓰는 곳만 적는다
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/**" },
    ],
  },
};

export default nextConfig;
