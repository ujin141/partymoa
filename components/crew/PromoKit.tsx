"use client";

import { useMemo, useState, useTransition } from "react";

import { writePost } from "@/app/(guest)/community/actions";
import { shortDate, timeRange, won } from "@/lib/format";
import { genderCap, priceFor } from "@/lib/rules";
import type { CrewMember, EventRow, TicketTier } from "@/types/database";

type Tier = TicketTier & { sold: number };

export type PromoData = {
  event: EventRow;
  crewName: string;
  tiers: Tier[];
  members: (CrewMember & { heads: number; revenue: number })[];
  booked: number;
  bookedF: number;
  bookedM: number;
};

function Copy({
  text,
  label = "복사",
}: {
  text: string;
  label?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const a = document.createElement("textarea");
          a.value = text;
          document.body.appendChild(a);
          a.select();
          document.execCommand("copy");
          a.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="flex-none rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-bold text-sub"
    >
      {done ? "복사됨" : label}
    </button>
  );
}

/**
 * 홍보 도구.
 *
 * 크루가 파티를 알릴 때 매번 하는 일은 정해져 있다 — 링크를 옮기고, 남은
 * 자리를 세어 문구를 쓰고, 멤버별 초대 코드를 나눠 준다. 그걸 손으로 하면
 * 숫자가 실제와 어긋나고, 어긋난 숫자로 홍보하면 예매하러 온 사람이
 * 마감을 본다.
 *
 * **문구의 숫자는 전부 지금 DB 값에서 만든다.** 사람이 고쳐 적을 자리를
 * 두지 않는 게 요점이다.
 */
export function PromoKit(p: PromoData) {
  const [busy, start] = useTransition();
  const [posted, setPosted] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/party/${p.event.slug}`;

  const open = p.tiers.filter((t) => t.sold < t.capacity);
  const now = open[0] ?? null;
  const left = Math.max(0, p.event.capacity - p.booked);
  const gcap = genderCap(p.event.capacity);
  const leftF = Math.max(0, gcap - p.bookedF);
  const leftM = Math.max(0, gcap - p.bookedM);

  const priceLine = now
    ? `${now.name} 여 ${won(now.price)} / 남 ${won(
        priceFor(
          now.price,
          "M",
          Number(p.event.male_price_multiplier),
          now.male_price,
        ),
      )}`
    : "전 차수 마감";

  const whenWhere = `${shortDate(p.event.starts_at)} ${timeRange(
    p.event.starts_at,
    p.event.ends_at,
  )} · ${p.event.venue_name}${p.event.area ? ` (${p.event.area})` : ""}`;

  /**
   * 상황마다 쓸 문구가 다르다. 지금 숫자를 보고 어느 걸 쓸지도 정해 준다 —
   * 자리가 넉넉한데 "마지막 기회" 를 쓰면 다음에 안 믿는다.
   */
  const drafts = useMemo(() => {
    const list: { key: string; label: string; when: string; text: string }[] = [
      {
        key: "open",
        label: "기본",
        when: "처음 알릴 때",
        text: [
          p.event.title,
          whenWhere,
          "",
          priceLine,
          `남은 자리 ${left}`,
          "",
          `예매 ${url}`,
        ].join("\n"),
      },
      {
        key: "closing",
        label: "마감 임박",
        when: "잔여 30% 이하일 때",
        text: [
          `${p.event.title} ${left}자리 남았습니다.`,
          `여성 ${leftF} · 남성 ${leftM}`,
          "",
          whenWhere,
          priceLine,
          "",
          url,
        ].join("\n"),
      },
      {
        key: "last",
        label: "막차",
        when: "열 자리 아래로 떨어졌을 때",
        text: [
          `${p.event.title} 마지막 ${left}자리.`,
          whenWhere,
          url,
        ].join("\n"),
      },
      {
        key: "chat",
        label: "오픈챗 한 줄",
        when: "단톡·오픈챗에 던질 때",
        text: `${shortDate(p.event.starts_at)} ${p.event.area} ${p.event.title} — ${priceLine}, ${left}자리 남음 → ${url}`,
      },
    ];
    return list;
  }, [p.event, whenWhere, priceLine, left, leftF, leftM, url]);

  const pick = left <= 10 ? "last" : left / p.event.capacity <= 0.3 ? "closing" : "open";

  return (
    <div className="px-4 pb-6">
      <div className="pb-3 pt-5">
        <h2 className="text-[19px] font-extrabold">홍보</h2>
        <p className="mt-1 text-[13px] text-sub">
          {`${p.event.title} · 남은 자리 ${left}`}
        </p>
      </div>

      <div className="rounded-xl bg-soft p-3.5">
        <div className="text-[12.5px] text-sub">파티 링크</div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
            {url}
          </span>
          <Copy text={url} />
        </div>
      </div>

      <h4 className="mb-2 mt-6 text-base font-extrabold">공유 문구</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        숫자는 지금 예매 현황에서 만듭니다. 고쳐 적지 말고 그대로 쓰세요 —
        틀린 숫자로 부르면 오는 사람이 마감을 봅니다.
      </p>
      {drafts.map((d) => (
        <div
          key={d.key}
          className={`mb-2.5 rounded-xl border p-3.5 ${
            d.key === pick ? "border-brand bg-brand-soft" : "border-line"
          }`}
        >
          <div className="flex items-center gap-2">
            <b className="text-[14px] font-extrabold">{d.label}</b>
            {d.key === pick ? (
              <span className="rounded bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
                지금 이거
              </span>
            ) : null}
            <span className="text-[12px] text-sub">{d.when}</span>
            <span className="ml-auto">
              <Copy text={d.text} />
            </span>
          </div>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-sub">
            {d.text}
          </pre>
        </div>
      ))}

      <h4 className="mb-1 mt-6 text-base font-extrabold">멤버 초대 링크</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        각자 자기 링크로 부르면 누가 몇 명 데려왔는지 자동으로 잡힙니다.
        코드를 손으로 입력하지 않아도 링크에 붙어 갑니다.
      </p>
      {p.members.length === 0 ? (
        <p className="py-4 text-[13px] text-sub">
          초대 코드를 발급한 멤버가 없어요. 크루 관리에서 멤버를 추가하세요.
        </p>
      ) : (
        p.members.map((m) => {
          const link = `${url}?i=${m.invite_code}`;
          return (
            <div
              key={m.id}
              className="flex items-center gap-2 border-b border-line py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold">{m.display_name}</div>
                <div className="mt-0.5 truncate text-[12px] text-sub">
                  {`${m.invite_code} · ${m.heads}명 · ${won(m.revenue)}`}
                </div>
              </div>
              <Copy text={link} label="링크 복사" />
            </div>
          );
        })
      )}

      <h4 className="mb-1 mt-6 text-base font-extrabold">커뮤니티에 올리기</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        파티모아 게시판에 이 파티 글을 답니다. 0원짜리 채널이고, 이미 앱에
        들어와 있는 사람에게 닿습니다.
      </p>
      {posted ? (
        <p className="rounded-xl bg-[#E7F7EF] px-4 py-3.5 text-[13px] leading-relaxed text-ok">
          {posted}
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              setErr(null);
              const body = drafts.find((d) => d.key === pick)!.text;
              const r = await writePost(p.crewName, body, p.event.id);
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setPosted("올렸어요. 커뮤니티 탭에서 확인할 수 있어요.");
            })
          }
          className="w-full rounded-xl border border-line py-3.5 text-[15px] font-semibold disabled:opacity-50"
        >
          {busy ? "올리는 중…" : `"${drafts.find((d) => d.key === pick)!.label}" 문구로 글 올리기`}
        </button>
      )}
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
    </div>
  );
}
