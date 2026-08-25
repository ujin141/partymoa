import type { MetadataRoute } from "next";

/** 크루·운영 화면은 검색에 걸리면 안 된다. 손님 명단이 들어 있다 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /terms, /privacy 는 열어 둔다 — 구글 OAuth 심사가 읽어야 한다
      disallow: ["/crew", "/admin", "/api", "/auth", "/tickets", "/my"],
    },
  };
}
