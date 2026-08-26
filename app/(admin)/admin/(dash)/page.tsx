import Link from "next/link";

import { allCrews, platformRows, rollup } from "@/lib/admin";
import { shortDate, won } from "@/lib/format";
import { FEE_RATE } from "@/lib/rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "운영 현황" };

const LABEL = {
  draft: "작성 중",
  open: "예매 중",
  closed: "마감",
  done: "종료",
} as const;

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-soft px-4 py-3">
      <small className="text-[12.5px] text-sub">{label}</small>
      <b className="mt-0.5 block text-[21px] font-extrabold">{value}</b>
      {note ? <div className="mt-0.5 text-[12px] text-sub">{note}</div> : null}
    </div>
  );
}

export default async function AdminHome() {
  const [rows, crews] = await Promise.all([platformRows(), allCrews()]);
  const byCrew = rollup(crews, rows);

  const revenue = rows.reduce((a, r) => a + Number(r.revenue_paid), 0);
  const fee = rows.reduce((a, r) => a + Number(r.fee), 0);
  const booked = rows.reduce((a, r) => a + r.booked, 0);
  const open = rows.filter((r) => r.status === "open");

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-3 pt-5">
        <h1 className="text-[21px] font-extrabold">운영 현황</h1>
        <p className="mt-1 text-[13px] text-sub">
          수수료는 입금 완료된 건에만 매깁니다 · {Math.round(FEE_RATE * 100)}%
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-4">
        <Kpi
          label="플랫폼 수수료"
          value={won(fee)}
          note={`거래액 ${won(revenue)}`}
        />
        <Kpi label="예매 인원" value={`${booked}명`} />
        <Kpi
          label="진행 중 파티"
          value={`${open.length}개`}
          note={`전체 ${rows.length}개`}
        />
        <Kpi label="크루" value={`${crews.length}팀`} />
      </div>

      <div className="px-4 pb-2 pt-6">
        <h2 className="text-[17px] font-extrabold">크루별</h2>
      </div>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-sub">
              <th className="py-2 font-medium">크루</th>
              <th className="py-2 font-medium">파티</th>
              <th className="py-2 font-medium">예매</th>
              <th className="py-2 text-right font-medium">확정 매출</th>
              <th className="py-2 text-right font-medium">수수료</th>
            </tr>
          </thead>
          <tbody>
            {byCrew.map((c) => (
              <tr key={c.crew.id} className="border-b border-line">
                <td className="py-2.5">
                  <Link
                    href={`/admin/crews#${c.crew.slug}`}
                    className="font-bold"
                  >
                    {c.crew.name}
                  </Link>
                </td>
                <td className="py-2.5 text-sub">
                  {c.events}개{c.open > 0 ? ` · 진행 ${c.open}` : ""}
                </td>
                <td className="py-2.5 text-sub">{c.booked}명</td>
                <td className="py-2.5 text-right font-semibold">
                  {won(c.revenue)}
                </td>
                <td className="py-2.5 text-right font-extrabold text-brand">
                  {won(c.fee)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 pb-2 pt-7">
        <h2 className="text-[17px] font-extrabold">파티별</h2>
      </div>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-sub">
              <th className="py-2 font-medium">파티</th>
              <th className="py-2 font-medium">크루</th>
              <th className="py-2 font-medium">날짜</th>
              <th className="py-2 font-medium">상태</th>
              <th className="py-2 font-medium">정원</th>
              <th className="py-2 text-right font-medium">확정 매출</th>
              <th className="py-2 text-right font-medium">수수료</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.event_id} className="border-b border-line">
                <td className="max-w-[180px] truncate py-2.5 font-bold">
                  <Link href={`/admin/events/${r.event_id}`}>{r.title}</Link>
                </td>
                <td className="py-2.5 text-sub">{r.crew_name}</td>
                <td className="py-2.5 text-sub">{shortDate(r.starts_at)}</td>
                <td className="py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      r.status === "open"
                        ? "bg-brand-soft text-brand"
                        : "bg-soft text-sub"
                    }`}
                  >
                    {LABEL[r.status]}
                  </span>
                </td>
                <td className="py-2.5 text-sub">
                  {r.booked}/{r.capacity}
                </td>
                <td className="py-2.5 text-right font-semibold">
                  {won(Number(r.revenue_paid))}
                </td>
                <td className="py-2.5 text-right font-extrabold text-brand">
                  {won(Number(r.fee))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-8" />
    </div>
  );
}
