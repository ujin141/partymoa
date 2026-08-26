import { ImageResponse } from "next/og";

import { longDate, timeRange } from "@/lib/format";
import {
  ACCENT,
  BRAND,
  DEEP,
  HOT,
  OG_SIZE,
  OG_TYPE,
  Wordmark,
  pretendard,
} from "@/lib/og";
import { getParty } from "@/lib/queries";
import { isClosingSoon, priceFor, soldRate } from "@/lib/rules";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "파티 상세";

/**
 * 파티별 링크 미리보기.
 *
 * **이게 제일 많이 보이는 화면일 것이다.** 손님은 앱에 들어오기 전에
 * 단톡방에서 이 카드를 먼저 본다.
 *
 * 처음엔 사진을 꽉 채우고 검은 겹을 덮었는데, 그러면 어느 예매 사이트나
 * 똑같이 생긴다. 지금은 **바이올렛이 바닥이고 사진이 오른쪽에 끼어드는**
 * 구조다 — 색만 봐도 파티모아인 걸 알아야 한다.
 *
 * 큰 열린 원을 사진 경계에 걸쳐 봤는데 반쯤 묻혀서 도형으로 안 읽혔다.
 * 뺐다 — 바이올렛과 워드마크만으로 이미 우리 것으로 보인다.
 * 노랑은 잔여 한 곳에만 쓴다. 여러 군데 쓰면 아무것도 안 도드라진다.
 */
export default async function PartyOG({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await getParty(slug);
  const fonts = await pretendard();

  if (!d) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${BRAND} 0%, ${DEEP} 100%)`,
            fontFamily: "Pretendard",
          }}
        >
          <Wordmark size={54} />
        </div>
      ),
      { ...size, fonts },
    );
  }

  const { event, stats, tier } = d;
  const left = Math.max(0, stats.capacity - stats.booked);
  const pct = soldRate(stats.booked, stats.capacity);
  const soon = isClosingSoon(stats.booked, stats.capacity);
  const price = tier
    ? priceFor(tier.price, "F", Number(event.male_price_multiplier))
    : null;
  const long = event.title.length > 16;

  /**
   * **satori 의 <img> 는 절대 주소만 받는다.** 커버를 우리 서버에 두면서
   * `/covers/...` 같은 상대 주소가 들어오는데, 그대로 넘기면 OG 카드에서
   * 사진 칸이 통째로 빈다 — 로컬에서는 안 보이고 배포 후에만 드러난다.
   */
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  const cover = event.cover_url?.startsWith("/")
    ? `${site}${event.cover_url}`
    : event.cover_url;

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
        {/* ── 오른쪽 사진 판. 왼쪽 모서리를 깎아 끼워 넣는다 ── */}
        {cover ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 470,
              display: "flex",
              overflow: "hidden",
              borderTopLeftRadius: 48,
              borderBottomLeftRadius: 48,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              width={470}
              height={630}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* 사진과 바이올렛이 맞닿는 선을 부드럽게 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(90deg, ${DEEP} 0%, rgba(68,22,200,0.35) 26%, rgba(68,22,200,0.06) 60%)`,
              }}
            />
          </div>
        ) : null}

        {/* ── 글자 ── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "54px 56px",
            width: 726,
          }}
        >
          <Wordmark size={28} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: 24, opacity: 0.82 }}>{d.crew.name}</span>
              {event.solo_friendly ? (
                <span
                  style={{
                    fontSize: 19,
                    padding: "5px 13px",
                    borderRadius: 999,
                    border: "1.5px solid rgba(255,255,255,0.45)",
                  }}
                >
                  1인 참여 환영
                </span>
              ) : null}
            </div>

            <div
              style={{
                fontSize: long ? 54 : 64,
                letterSpacing: -2.5,
                lineHeight: 1.16,
                maxWidth: 604,
                // 어절 단위로 넘긴다. 없으면 "풀파" / "티" 로 한 글자만 갈린다
                wordBreak: "keep-all",
              }}
            >
              {event.title}
            </div>

            {/* satori 는 자식이 둘 이상인 div 에 display:flex 를 요구한다.
                {a} · {b} 로 쓰면 자식 셋이 되므로 한 문자열로 합친다 */}
            <div style={{ marginTop: 24, fontSize: 27, opacity: 0.9 }}>
              {`${longDate(event.starts_at)} · ${timeRange(event.starts_at, event.ends_at)}`}
            </div>
            <div style={{ marginTop: 7, fontSize: 27, opacity: 0.9 }}>
              {`${event.venue_name} · ${event.area}`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {price ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 19, opacity: 0.65 }}>
                  {tier?.name ?? ""}
                </span>
                <span
                  style={{ marginTop: 2, fontSize: 42, letterSpacing: -1.5 }}
                >
                  {`${price.toLocaleString("ko-KR")}원부터`}
                </span>
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <span style={{ fontSize: 19, opacity: 0.65 }}>
                {`${pct}% 예매 · 정원 ${stats.capacity}명`}
              </span>
              <span
                style={{
                  marginTop: 2,
                  fontSize: 42,
                  letterSpacing: -1.5,
                  // 노랑은 여기 하나뿐이다. 마감이면 빨강으로 넘긴다
                  color: left === 0 ? HOT : soon ? ACCENT : "#fff",
                }}
              >
                {left === 0 ? "매진됐어요" : `${left}자리 남았어요`}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
