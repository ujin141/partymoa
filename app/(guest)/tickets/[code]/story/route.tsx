import { ImageResponse } from "next/og";

import { longDate, timeRange } from "@/lib/format";
import { ACCENT, BRAND, DEEP, Mark, Wordmark, pretendard } from "@/lib/og";
import { createClient } from "@/lib/supabase/server";
import type { Booking, EventRow, TicketTier } from "@/types/database";

/**
 * 인스타 스토리용 티켓 이미지 (1080×1920).
 *
 * **예매번호로 아무나 열 수 없다.** PM0001 부터 순서대로라 주소만 바꾸면
 * 남의 티켓이 나온다 — 이름이 박혀 있는 그림이라 그러면 안 된다.
 * 그래서 여기서 코드로 찾지 않고, **로그인한 사람의 예매 중에서** 그
 * 코드를 고른다. RLS 가 한 번 더 막는다.
 *
 * 세로 9:16 은 스토리에 그대로 올라간다. 위아래로 여백을 크게 둔 이유는
 * 인스타가 위에 프로필, 아래에 답장 칸을 덮기 때문이다 — 거기 글자가
 * 있으면 가려진다.
 */
export const runtime = "nodejs";

const W = 1080;
const H = 1920;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("로그인이 필요해요", { status: 401 });

  const { data } = await supabase
    .from("bookings")
    .select("*, event:events (*), tier:ticket_tiers (*)")
    .eq("user_id", user.id)
    .eq("code", code.toUpperCase())
    .neq("status", "cancelled")
    .maybeSingle();

  const b = data as unknown as
    | (Booking & { event: EventRow; tier: TicketTier | null })
    | null;
  if (!b) return new Response("티켓을 찾을 수 없어요", { status: 404 });

  const paid = b.status !== "pending";
  const ev = b.event;

  /**
   * **satori 의 <img> 는 절대 주소만 받는다.** 커버가 우리 서버에 있으면
   * `/covers/...` 로 들어오는데 그대로 넘기면 사진 칸이 그냥 빈다.
   */
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : new URL(_req.url).origin);
  const cover = ev.cover_url
    ? ev.cover_url.startsWith("/")
      ? `${site}${ev.cover_url}`
      : ev.cover_url
    : null;

  // 사진이 끝나는 높이. 아래 배경 그라데이션의 첫 구간을 여기까지 같은
  // 색으로 잡아 두면 사진과 배경이 이어 붙은 자리가 안 보인다
  const PHOTO = 1100;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: cover
            ? `linear-gradient(180deg, ${DEEP} 0%, ${DEEP} ${(PHOTO / H) * 100}%, #2A0B86 100%)`
            : `linear-gradient(160deg, ${BRAND} 0%, ${DEEP} 58%, #2A0B86 100%)`,
          fontFamily: "Pretendard",
          color: "#fff",
          position: "relative",
        }}
      >
        {/* 예매한 파티의 커버. **위를 사진으로 채운다** — 스토리에서
            제일 먼저 눈에 들어오는 자리이고, 그림 없이 글자만 있으면
            누가 올려도 똑같아 보인다 */}
        {cover ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: PHOTO,
              display: "flex",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              width={W}
              height={PHOTO}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* 위는 살짝 눌러 워드마크가 읽히게, 아래는 배경색까지 녹인다 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: PHOTO,
                display: "flex",
                background: `linear-gradient(180deg, rgba(26,7,80,0.62) 0%, rgba(26,7,80,0.18) 26%, rgba(68,22,200,0.62) 72%, ${DEEP} 100%)`,
              }}
            />
          </div>
        ) : (
          /* 커버가 없으면 큰 심볼로 채운다 */
          <div
            style={{
              position: "absolute",
              top: 470,
              left: -260,
              display: "flex",
              opacity: 0.09,
            }}
          >
            <Mark size={900} dot="#fff" accent="#fff" />
          </div>
        )}

        {/* 위 240px 은 비운다 — 인스타가 프로필 줄로 덮는다 */}
        <div style={{ display: "flex", height: 240 }} />

        <div style={{ display: "flex", paddingLeft: 92 }}>
          <Wordmark size={44} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "64px 92px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: paid ? ACCENT : "rgba(255,255,255,0.22)",
              color: paid ? "#16181D" : "#fff",
              borderRadius: 999,
              padding: "14px 30px",
              fontSize: 34,
            }}
          >
            {paid ? "예매 확정" : "입금 대기"}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 92,
              lineHeight: 1.16,
              marginTop: 40,
              letterSpacing: -3,
            }}
          >
            {ev.title}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 40,
              marginTop: 30,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {`${longDate(ev.starts_at)} · ${timeRange(ev.starts_at, ev.ends_at)}`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              marginTop: 12,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {`${ev.venue_name}${ev.area ? ` · ${ev.area}` : ""}`}
          </div>
        </div>

        {/* 표. 예매번호가 제일 크다 — 현장에서 이걸 대고 들어간다 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            margin: "72px 92px 0",
            background: "rgba(255,255,255,0.12)",
            border: "2px solid rgba(255,255,255,0.28)",
            borderRadius: 44,
            padding: "52px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            예매번호
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 132,
              letterSpacing: 6,
              marginTop: 6,
              color: ACCENT,
            }}
          >
            {b.code}
          </div>

          <div style={{ display: "flex", gap: 72, marginTop: 46 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                이름
              </div>
              <div style={{ display: "flex", fontSize: 46, marginTop: 8 }}>
                {b.name}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                인원
              </div>
              <div style={{ display: "flex", fontSize: 46, marginTop: 8 }}>
                {`${b.quantity}명`}
              </div>
            </div>
            {b.tier ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 28,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  차수
                </div>
                <div style={{ display: "flex", fontSize: 46, marginTop: 8 }}>
                  {b.tier.name}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* 아래 300px 도 비운다 — 답장 칸이 덮는다 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingBottom: 300,
          }}
        >
          <div style={{ display: "flex", fontSize: 40, opacity: 0.92 }}>
            혼자 와도 됩니다
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              marginTop: 14,
              color: ACCENT,
            }}
          >
            partymoa.com
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: await pretendard(),
      headers: {
        // 남의 캐시에 걸리면 안 된다. 이름이 박힌 그림이다
        "cache-control": "private, no-store",
      },
    },
  );
}
