import { ImageResponse } from "next/og";

import { longDate, timeRange } from "@/lib/format";
import { BRAND, DEEP, Mark, OG_SIZE, OG_TYPE, pretendard } from "@/lib/og";
import { getParty } from "@/lib/queries";
import { priceFor, soldRate } from "@/lib/rules";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "파티 상세";

/**
 * 파티별 링크 미리보기.
 *
 * **이게 제일 많이 보이는 화면일 것이다.** 손님은 앱에 들어오기 전에
 * 단톡방에서 이 카드를 먼저 본다. 그래서 커버 사진만 던지지 않고
 * 언제·어디서·얼마나 남았는지를 사진 위에 얹는다 — 사진만 있으면
 * 어느 파티인지도 모른다.
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
            background: BRAND,
            color: "#fff",
            fontSize: 56,
            fontFamily: "Pretendard",
          }}
        >
          파티모아
        </div>
      ),
      { ...size, fonts },
    );
  }

  const { event, stats, tier } = d;
  const left = Math.max(0, stats.capacity - stats.booked);
  const pct = soldRate(stats.booked, stats.capacity);
  const price = tier
    ? priceFor(tier.price, "F", Number(event.male_price_multiplier))
    : null;

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
        {event.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.cover_url}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* 사진 위에 글자를 얹으려면 어둡게 깔아야 읽힌다.
            **두 겹이다.** 가로 한 겹만 깔면 오른쪽 아래 잔여 숫자가
            밝은 사진에 묻힌다 — 밝은 사진이 들어올지 어두운 사진이
            들어올지 우리가 정하지 못한다 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(8,10,14,0.90) 0%, rgba(8,10,14,0.66) 55%, rgba(8,10,14,0.24) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(8,10,14,0.82) 0%, rgba(8,10,14,0.20) 34%, rgba(8,10,14,0) 60%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Mark size={40} />
            <span style={{ fontSize: 24, opacity: 0.85 }}>{d.crew.name}</span>
            {event.solo_friendly ? (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 20,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: BRAND,
                }}
              >
                1인 참여 환영
              </span>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: event.title.length > 18 ? 60 : 72,
                letterSpacing: -2.5,
                lineHeight: 1.15,
                maxWidth: 900,
              }}
            >
              {event.title}
            </div>
            {/* satori 는 자식이 둘 이상인 div 에 display:flex 를 요구한다.
                {a} · {b} 로 쓰면 자식 셋이 되므로 한 문자열로 합친다 */}
            <div style={{ marginTop: 22, fontSize: 30, opacity: 0.88 }}>
              {`${longDate(event.starts_at)} · ${timeRange(event.starts_at, event.ends_at)}`}
            </div>
            <div style={{ marginTop: 8, fontSize: 30, opacity: 0.88 }}>
              {`${event.venue_name} · ${event.area}`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
            {price ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 20, opacity: 0.7 }}>
                  {tier?.name ?? ""}
                </span>
                <span style={{ fontSize: 44, letterSpacing: -1.5 }}>
                  {`${price.toLocaleString("ko-KR")}원부터`}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 44 }}>매진</span>
            )}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <span style={{ fontSize: 20, opacity: 0.7 }}>
                {`${pct}% 예매 · 정원 ${stats.capacity}명`}
              </span>
              <span
                style={{
                  fontSize: 40,
                  color: left === 0 ? "#FF3B5C" : "#fff",
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
