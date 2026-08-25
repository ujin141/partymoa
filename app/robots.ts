import type { MetadataRoute } from "next";

/** 크루·운영 화면은 검색에 걸리면 안 된다. 손님 명단이 들어 있다 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/crew", "/admin", "/api", "/auth", "/tickets", "/my"],
    },
  };
}
