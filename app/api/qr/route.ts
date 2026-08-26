import QRCode from "qrcode";

/**
 * QR 코드 (SVG).
 *
 * **우리 주소만 만들어 준다.** 아무 문자열이나 받아 주면 남이 우리
 * 서버로 피싱 링크 QR 을 찍어 간다. 경로만 받고 도메인은 서버가 붙인다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("p") ?? "/";
  // 경로만 받는다. `//evil.com` 같은 스킴 없는 절대 주소도 막는다
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : url.origin);

  const svg = await QRCode.toString(`${site}${path}`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#16181D", light: "#0000" },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
    },
  });
}
