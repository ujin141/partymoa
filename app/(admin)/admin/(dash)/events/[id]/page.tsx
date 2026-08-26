import Link from "next/link";
import { notFound } from "next/navigation";

import { adminEvent, heads, live, money } from "@/lib/crew";
import { longDate, stamp, won } from "@/lib/format";
import { FEE_RATE, genderCap, priceFor } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";
import type { Crew } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "파티 상세", robots: { index: false } };

const LABEL = {
  pending: "미입금",
  paid: "입금완료",
  checked_in: "입장완료",
  cancelled: "취소",
} as const;

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-soft px-4 py-3">
      <small className="text-[12.5px] text-sub">{label}</small>
      <b className="mt-0.5 block text-[19px] font-extrabold">{value}</b>
      {note ? <div className="mt-0.5 text-[12px] text-sub">{note}</div> : null}
    </div>
  );
}

/**
 * 운영자가 보는 파티 한 건. **예매를 한 건씩 다 편다.**
 *
 * 크루 화면(`/crew/list`)은 현장에서 폰으로 쓰는 것이라 카드로 접어 두지만,
 * 운영자는 노트북에서 표로 본다 — 입금이 안 맞거나 손님 문의가 들어왔을 때
 * 어느 건인지 찾아내는 게 일이라 값이 다 보여야 한다. 취소된 건도 남겨
 * 둔다. 자동 취소가 언제 걸렸는지 못 보면 "예매했는데 없어졌다" 를 확인해
 * 줄 방법이 없다.
 *
 * **상태를 바꾸는 버튼은 두지 않는다.** 입금 확인과 입장 처리는 크루 일이다.
 */
export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await adminEvent(id);
  if (!data) notFound();

  const { event, stats, tiers, bookings } = data;
  const supabase = await createClient();
  const { data: crewRow } = await supabase
    .from("crews")
    .select("*")
    .eq("id", event.crew_id)
    .maybeSingle();
  const crew = crewRow as Crew | null;

  const rows = live(bookings);
  const paid = rows.filter((b) => b.status !== "pending");
  const unpaid = rows.filter((b) => b.status === "pending");
  const inside = rows.filter((b) => b.status === "checked_in");
  const gcap = genderCap(event.capacity);
  const revenue = money(paid);
  const tierName = (tid: string) => tiers.find((t) => t.id === tid)?.name ?? "";

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-4 pt-5">
        <Link href="/admin" className="text-[13px] text-sub">
          ‹ 운영 현황
        </Link>
        <h1 className="mt-1.5 text-[21px] font-extrabold">{event.title}</h1>
        <p className="mt-1 text-[13px] text-sub">
          {`${crew?.name ?? "크루 미상"} · ${longDate(event.starts_at)} · ${event.venue_name}`}
        </p>
        <Link
          href={`/party/${event.slug}`}
          className="mt-2 inline-block text-[13px] text-brand underline"
        >
          손님이 보는 화면 열기
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-4">
        <Kpi
          label="예매"
          value={`${stats.booked}명`}
          note={`정원 ${event.capacity} · 잔여 ${Math.max(0, event.capacity - stats.booked)}`}
        />
        <Kpi
          label="입금 완료"
          value={`${heads(paid)}명`}
          note={`미입금 ${heads(unpaid)}명`}
        />
        <Kpi
          label="확정 매출"
          value={won(revenue)}
          note={`예정 포함 ${won(money(rows))}`}
        />
        <Kpi
          label="수수료"
          value={won(Math.round(revenue * FEE_RATE))}
          note={`${Math.round(FEE_RATE * 100)}% · 입금 건만`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 pt-2.5 sm:grid-cols-4">
        <Kpi
          label="여성"
          value={`${stats.booked_f}명`}
          note={event.gender_balanced ? `상한 ${gcap}명` : "성비 조절 꺼짐"}
        />
        <Kpi
          label="남성"
          value={`${stats.booked_m}명`}
          note={event.gender_balanced ? `상한 ${gcap}명` : "성비 조절 꺼짐"}
        />
        <Kpi label="입장 완료" value={`${heads(inside)}명`} />
        <Kpi label="예매 건수" value={`${rows.length}건`} />
      </div>

      <div className="px-4 pb-2 pt-7">
        <h2 className="text-[17px] font-extrabold">차수</h2>
      </div>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[520px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-sub">
              <th className="py-2 font-medium">차수</th>
              <th className="py-2 text-right font-medium">여성가</th>
              <th className="py-2 text-right font-medium">남성가</th>
              <th className="py-2 text-right font-medium">판매</th>
              <th className="py-2 text-right font-medium">남은 장수</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id} className="border-b border-line">
                <td className="py-2.5 font-bold">{t.name}</td>
                <td className="py-2.5 text-right">{won(t.price)}</td>
                <td className="py-2.5 text-right">
                  {`${won(
                    priceFor(
                      t.price,
                      "M",
                      Number(event.male_price_multiplier),
                      t.male_price,
                    ),
                  )}${t.male_price == null ? " (계수)" : ""}`}
                </td>
                <td className="py-2.5 text-right">
                  {`${t.sold}/${t.capacity}`}
                </td>
                <td className="py-2.5 text-right font-semibold">
                  {Math.max(0, t.capacity - t.sold)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-baseline gap-2 px-4 pb-2 pt-7">
        <h2 className="text-[17px] font-extrabold">예매 명단</h2>
        <span className="text-[13px] text-sub">
          {`${bookings.length}건 (취소 포함)`}
        </span>
      </div>
      {bookings.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-sub">
          아직 예매가 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto px-4">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12.5px] text-sub">
                <th className="py-2 font-medium">예매번호</th>
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">연락처</th>
                <th className="py-2 font-medium">성별</th>
                <th className="py-2 font-medium">인원</th>
                <th className="py-2 font-medium">차수</th>
                <th className="py-2 text-right font-medium">금액</th>
                <th className="py-2 font-medium">초대</th>
                <th className="py-2 font-medium">상태</th>
                <th className="py-2 font-medium">신청</th>
                <th className="py-2 font-medium">입금·입장</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  className={`border-b border-line ${
                    b.status === "cancelled" ? "text-[#B4B8C2]" : ""
                  }`}
                >
                  <td className="py-2.5 font-semibold">{b.code}</td>
                  <td className="py-2.5 font-bold">{b.name}</td>
                  <td className="py-2.5 text-sub">{b.phone || "—"}</td>
                  <td className="py-2.5">{b.gender === "F" ? "여" : "남"}</td>
                  <td className="py-2.5">{b.quantity}</td>
                  <td className="py-2.5 text-sub">{tierName(b.tier_id)}</td>
                  <td className="py-2.5 text-right font-semibold">
                    {won(b.amount)}
                  </td>
                  <td className="py-2.5 text-sub">{b.invite_code ?? "—"}</td>
                  <td className="py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                        b.status === "pending"
                          ? "bg-[#FDECEF] text-hot"
                          : b.status === "cancelled"
                            ? "bg-soft text-sub"
                            : "bg-[#E7F7EF] text-ok"
                      }`}
                    >
                      {LABEL[b.status]}
                    </span>
                  </td>
                  <td className="py-2.5 text-sub">{stamp(b.created_at)}</td>
                  <td className="py-2.5 text-sub">
                    {b.status === "pending"
                      ? `만료 ${stamp(b.expires_at)}`
                      : [
                          b.paid_at ? `입금 ${stamp(b.paid_at)}` : null,
                          b.checked_in_at
                            ? `입장 ${stamp(b.checked_in_at)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="h-8" />
    </div>
  );
}
