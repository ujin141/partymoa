import type { MetadataRoute } from "next";

import { listOpenParties } from "@/lib/queries";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** 열려 있는 파티만. 끝난 행사가 검색에 남으면 헛걸음이 생긴다 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const parties = await listOpenParties().catch(() => []);

  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/explore`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/community`, changeFrequency: "hourly", priority: 0.5 },
    ...parties.map((d) => ({
      url: `${SITE}/party/${d.event.slug}`,
      lastModified: new Date(d.event.created_at),
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];
}
