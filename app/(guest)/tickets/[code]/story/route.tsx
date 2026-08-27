import { ImageResponse } from "next/og";

import { longDate, timeRange } from "@/lib/format";
import { ACCENT, Wordmark, michroma, pretendard } from "@/lib/og";
import { createClient } from "@/lib/supabase/server";
import type {
  Booking,
  EventRow,
  EventTable,
  TicketTier,
} from "@/types/database";

/**
 * 인스타 스토리용 티켓 이미지 (1080×1920).
 *
 * **예매번호로 아무나 열 수 없다.** PM0001 부터 순서대로라 주소만 바꾸면
 * 남의 티켓이 나온다 — 이름이 박혀 있는 그림이라 그러면 안 된다.
 * 코드로 찾지 않고 **로그인한 사람의 예매 중에서** 그 코드를 고른다.
 * RLS 가 한 번 더 막는다.
 *
 * 디자인은 **입장권 형태**다. 파티 사진을 위에 깔고 아래에 흰 스텁을
 * 얹는다. 옆구리 노치와 점선이 있어야 한 눈에 티켓으로 읽힌다 — 그냥
 * 둥근 상자면 카드 뉴스처럼 보인다.
 *
 * **입금 대기는 안 적는다.** 스토리는 자랑하는 자리다. 거기에 "아직 돈
 * 안 냈음" 을 박아 주는 건 아무에게도 도움이 안 된다. 입금 안내는 앱
 * 안에서 이미 충분히 한다.
 *
 * 위 240px, 아래 300px 은 비운다 — 인스타가 프로필 줄과 답장 칸으로 덮어서
 * 거기 글자가 있으면 가려진다.
 *
 * ## 테이블은 티켓이 달라야 한다
 *
 * 30만원짜리 테이블을 잡은 사람과 입장권 한 장을 산 사람의 스토리가
 * 똑같으면 **테이블을 잡을 이유 하나가 사라진다.** 자랑할 자리를 주는 게
 * 테이블 값의 일부다.
 *
 * 다만 판을 통째로 바꾸지는 않는다. 같은 서비스의 티켓으로 보여야 하므로
 * 바뀌는 건 셋뿐이다 — 스텁 색, 라벨, 테두리.
 *
 *     일반    흰 스텁 · ADMIT ONE
 *     VIP     흰 스텁 · 금색 테두리 · VIP TABLE
 *     VVIP    **검은 스텁 · 금색 글자** · VVIP TABLE
 *
 * VVIP 만 반전시킨다. 색을 조금씩 다르게 하면 나란히 놓고 봐야 차이를
 * 아는데, 반전은 한 장만 봐도 다르다.
 */
export const runtime = "nodejs";

const W = 1080;
const H = 1920;
const BG = "#0B0A12";
const PHOTO = 900;

export async function GET(
  req: Request,
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
    .select("*, event:events (*), tier:ticket_tiers (*), table:event_tables (*)")
    .eq("user_id", user.id)
    .eq("code", code.toUpperCase())
    .neq("status", "cancelled")
    .maybeSingle();

  const b = data as unknown as
    | (Booking & {
        event: EventRow;
        tier: TicketTier | null;
        table: EventTable | null;
      })
    | null;
  if (!b) return new Response("티켓을 찾을 수 없어요", { status: 404 });

  const ev = b.event;

  /**
   * 테이블 등급. **이름으로 가른다** — 크루가 테이블 이름을 자유롭게
   * 짓기 때문에 등급 칼럼이 따로 없다. VVIP 를 먼저 본다. VIP 를 먼저
   * 보면 'VVIP' 도 VIP 로 잡힌다.
   */
  const tname = (b.table?.name ?? "").toUpperCase();
  const rank = !b.table ? "none" : tname.includes("VVIP") ? "vvip" : "vip";

  const GOLD = "#D8B45A";
  const skin =
    rank === "vvip"
      ? { stub: "#14131C", ink: "#F3EEE2", dim: "#9A937F",
          line: GOLD, edge: GOLD, label: b.table!.name.toUpperCase() }
      : rank === "vip"
        ? { stub: "#fff", ink: "#16181D", dim: "#8A8FA0",
            line: "#D8DBE3", edge: GOLD, label: b.table!.name.toUpperCase() }
        : { stub: "#fff", ink: "#16181D", dim: "#8A8FA0",
            line: "#D8DBE3", edge: "transparent", label: "ADMIT ONE" };

  // satori 의 <img> 는 절대 주소만 받는다. 커버가 `/covers/...` 로 들어오면
  // 그대로 넘길 수 없다
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : new URL(req.url).origin);
  const cover = ev.cover_url
    ? ev.cover_url.startsWith("/")
      ? `${site}${ev.cover_url}`
      : ev.cover_url
    : null;

  const [fonts, mich] = await Promise.all([pretendard(), michroma()]);

  const label = { fontSize: 25, color: skin.dim, letterSpacing: 1 };
  const value = { fontSize: 42, color: skin.ink };

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: BG,
          fontFamily: "Pretendard",
          color: "#fff",
          position: "relative",
        }}
      >
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
            {/* 아래로 갈수록 배경색까지 녹인다. 사진이 끝나는 선이 보이면
                오려 붙인 것처럼 된다 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: PHOTO,
                display: "flex",
                background: `linear-gradient(180deg, rgba(11,10,18,0.66) 0%, rgba(11,10,18,0.12) 30%, rgba(11,10,18,0.55) 74%, ${BG} 100%)`,
              }}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/*
          워드마크를 사진 위에 얹지 않는다. 커버가 이미 포스터라 파티 제목과
          겹쳐서 둘 다 안 읽힌다. 사진이 끝난 자리에 작게 둔다
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "0 84px",
          }}
        >
          <div style={{ display: "flex", marginBottom: 30 }}>
            <Wordmark size={30} />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              lineHeight: 1.18,
              letterSpacing: -2.5,
            }}
          >
            {ev.title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 36,
              marginTop: 26,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {`${longDate(ev.starts_at)}  ${timeRange(ev.starts_at, ev.ends_at)}`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 36,
              marginTop: 10,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {`${ev.venue_name}${ev.area ? `  ·  ${ev.area}` : ""}`}
          </div>
        </div>

        {/* ── 입장권 스텁 ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            margin: "56px 84px 0",
            background: skin.stub,
            borderRadius: 40,
            border: `3px solid ${skin.edge}`,
            padding: "43px 49px 41px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Michroma",
              fontSize: 22,
              letterSpacing: 7,
              color: rank === "none" ? skin.dim : GOLD,
            }}
          >
            {skin.label}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Michroma",
              fontSize: 96,
              letterSpacing: 2,
              marginTop: 16,
              color: skin.ink,
            }}
          >
            {b.code}
          </div>

          {/*
            점선과 양옆 노치. **이 둘이 있어야 티켓으로 읽힌다** — 없으면
            그냥 둥근 흰 상자라 카드뉴스처럼 보인다.
            노치는 점선 줄에 붙여 둔다. 스텁 기준으로 좌표를 찍으면 위쪽
            글자 길이가 바뀔 때마다 어긋난다
          */}
          <div
            style={{
              display: "flex",
              position: "relative",
              height: 3,
              marginTop: 34,
              marginBottom: 30,
              background:
                `repeating-linear-gradient(90deg, ${skin.line} 0 14px, rgba(0,0,0,0) 14px 28px)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -78,
                top: -25,
                width: 52,
                height: 52,
                borderRadius: 26,
                background: BG,
                display: "flex",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: -78,
                top: -25,
                width: 52,
                height: 52,
                borderRadius: 26,
                background: BG,
                display: "flex",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 64 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", ...label }}>이름</div>
              <div style={{ display: "flex", marginTop: 8, ...value }}>
                {b.name}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", ...label }}>인원</div>
              <div style={{ display: "flex", marginTop: 8, ...value }}>
                {`${b.quantity}명`}
              </div>
            </div>
            {b.table ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", ...label }}>테이블</div>
                <div
                  style={{ display: "flex", marginTop: 8, ...value, color: GOLD }}
                >
                  {b.table.name}
                </div>
              </div>
            ) : b.tier ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", ...label }}>차수</div>
                <div style={{ display: "flex", marginTop: 8, ...value }}>
                  {b.tier.name}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            margin: "40px 84px 0",
          }}
        >
          {/* 테이블 잡은 사람에게 "혼자 와도 됩니다" 는 안 맞는다.
              그쪽은 자리를 통째로 산 사람이다 */}
          <div style={{ display: "flex", fontSize: 32, opacity: 0.72 }}>
            {b.table
              ? `${b.table.name} · ${b.table.seats}인 입장`
              : "혼자 와도 됩니다"}
          </div>
          <div style={{ display: "flex", flexGrow: 1 }} />
          <div
            style={{
              display: "flex",
              fontFamily: "Michroma",
              fontSize: 26,
              letterSpacing: 2,
              color: ACCENT,
            }}
          >
            PARTYMOA.COM
          </div>
        </div>

        {/* 아래 300px 은 답장 칸이 덮는다 */}
        <div style={{ display: "flex", height: 300 }} />
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [...fonts, mich],
      headers: {
        // 남의 캐시에 걸리면 안 된다. 이름이 박힌 그림이다
        "cache-control": "private, no-store",
      },
    },
  );
}
