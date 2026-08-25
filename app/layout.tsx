import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 한글은 Pretendard(자체 호스팅, public/fonts), 영문·숫자는 Inter.
// Pretendard 는 동적 서브셋이라 쓰는 글자 범위만 내려받는다.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * 링크 미리보기는 **절대 주소**여야 한다. metadataBase 가 없으면 OG 이미지가
 * "/opengraph-image" 로 나가고 카톡·인스타가 못 읽는다.
 * 배포 주소는 Vercel 이 넣어 주는 값을 쓰고, 없으면 로컬로 떨어진다.
 *
 * **dev 에서는 이 값이 안 보인다.** next dev 는 og:image 주소를 요청 origin
 * (localhost)으로 덮어쓴다. 확인하려면 프로덕션 빌드로 봐야 한다 —
 * 여기서 시간 버리지 말 것.
 */
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  // %s 자리에 각 화면 제목이 들어간다. 화면마다 " — 파티모아" 를 손으로
  // 붙이던 걸 여기 한 줄로 모은다
  title: { default: "파티모아 — 파티 예매", template: "%s — 파티모아" },
  description: "서울 언더그라운드 파티를 한 곳에서. 사전예매 플랫폼.",
  applicationName: "파티모아",
  appleWebApp: { capable: true, title: "파티모아", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "파티모아",
    locale: "ko_KR",
  },
  // 이걸 안 넣으면 X 에서 작은 썸네일로 뜬다. 이미지는 각 화면의
  // opengraph-image 를 그대로 쓴다
  twitter: { card: "summary_large_image" },
  // 구글 OAuth 동의 화면이 승인된 도메인의 소유를 확인할 때 읽는다.
  // Search Console 에서 발급한 값이라 지우면 확인이 풀린다
  verification: {
    google: "EMMp3dZPFBgCzJ9ZO6DsXqO9Ha3hlYjPdesl1KG2L7k",
  },
};

export const viewport: Viewport = {
  themeColor: "#5B2BE8",
  width: "device-width",
  initialScale: 1,
  // 확대를 막지 않는다. 시력이 약한 사람이 못 쓰게 된다
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* suppressHydrationWarning 은 **이 두 태그에만** 건다.
       크롬 확장이 body 에 ap-style, __processed_…__ 같은 속성을 끼워 넣어
       서버가 보낸 HTML 과 달라진다. 우리 잘못이 아니고 고칠 수도 없다.
       속성만 무시할 뿐 자식 요소의 불일치는 그대로 잡힌다 — 아래로
       내려 달지 말 것. */
    <html lang="ko" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Pretendard 동적 서브셋. 92개 조각 중 쓰는 글자 범위만 내려온다.
            postcss @import 로 넣으면 빌드가 public/ 을 못 찾는다 */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard.css" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
