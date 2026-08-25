import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉터리에 다른 lockfile 이 있어 Next 가 루트를 잘못 잡는다
  turbopack: { root: path.dirname(new URL(import.meta.url).pathname).slice(1) },
  // OG 카드가 fs 로 읽는 폰트다. 이걸 안 적으면 Vercel 번들에서 빠져
  // 배포 후에만 "파일 없음" 으로 터진다 — 로컬에서는 멀쩡하다
  outputFileTracingIncludes: {
    // 라우트 이름에 해시 접미사가 붙는다 (opengraph-image-1jkstu). 글로브로 잡는다
    "/opengraph-image*": ["./assets/og/**"],
    "/party/[slug]/opengraph-image*": ["./assets/og/**"],
  },
  images: {
    // 커버는 크루가 주소로 넣는다. 아무 호스트나 열면 우리 서버가
    // 남의 이미지 리사이저가 되므로 쓰는 곳만 적는다
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/**" },
    ],
  },
};

export default nextConfig;
