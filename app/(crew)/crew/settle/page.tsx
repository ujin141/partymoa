import { CrewPicker } from "@/components/crew/CrewPicker";
import { EventPicker } from "@/components/crew/EventPicker";
import { ExpenseEditor } from "@/components/crew/ExpenseEditor";
import { Divider } from "@/components/ui/primitives";
import { heads, live, money } from "@/lib/crew";
import { crewPage } from "@/lib/crew-page";
import { won } from "@/lib/format";
import { FEE_RATE, settle } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "정산" };

function Line({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center border-b border-line py-3 last:border-b-0">
      <span className="text-[14.5px] font-semibold">{label}</span>
      <span
        className={`ml-auto text-[15px] font-extrabold ${
          negative ? "text-hot" : ""
        }`}
      >
        {negative ? "−" : ""}
        {won(Math.abs(value))}
      </span>
    </div>
  );
}

export default async function CrewSettlePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; e?: string }>;
}) {
  const { crew, crews, events, current } = await crewPage(searchParams);
  if (!current) {
    return (
      <div className="flex-1">
        <CrewPicker crews={crews} current={crew.id} />
        <p className="px-6 py-16 text-center text-sm text-sub">
          {crew.name} 에 등록한 파티가 없어요.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("event_expenses")
    .select("*")
    .eq("event_id", current.event.id)
    .order("sort_order");

  const rows = live(current.bookings);
  const paid = rows.filter((b) => b.status !== "pending");
  const list = (expenses ?? []) as {
    id: string;
    label: string;
    amount: number;
  }[];
  const s = settle(
    money(paid),
    list.map((x) => x.amount),
  );

  const unpaidRows = rows.filter((b) => b.status === "pending");
  const overdue = unpaidRows.filter(
    (b) => new Date(b.expires_at).getTime() < Date.now(),
  );

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <CrewPicker crews={crews} current={crew.id} />
      <EventPicker events={events} current={current.event.id} />

      <div className="px-4 pb-3 pt-5">
        <h2 className="text-[19px] font-extrabold">정산</h2>
        <p className="mt-1 text-[13px] text-sub">입금 완료 기준 · 예상치</p>
      </div>

      <div className="px-4">
        <Line label="입장료 매출" value={s.gross} />
        <Line
          label={`플랫폼 수수료 ${Math.round(FEE_RATE * 100)}%`}
          value={s.fee}
          negative
        />
        {list.map((x) => (
          <Line key={x.id} label={x.label} value={x.amount} negative />
        ))}
        <div className="mt-1 flex items-center border-t-2 border-ink py-3">
          <span className="text-[15px] font-extrabold">크루 정산액</span>
          <span className="ml-auto text-[19px] font-extrabold">
            {won(s.net)}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
          바 매출은 장소 귀속이라 이 계산에 넣지 않았어요.
        </p>
      </div>

      <Divider />

      <div className="px-4 pt-4">
        <h4 className="mb-3 text-base font-extrabold">지출</h4>
        <ExpenseEditor eventId={current.event.id} items={list} />
      </div>

      <Divider />

      <div className="px-4 py-4">
        <h4 className="mb-1 text-base font-extrabold">미수금</h4>
        <Line label="미입금 예매" value={money(unpaidRows)} />
        <p className="mt-2 text-[12.5px] leading-relaxed text-sub">
          미입금 {heads(unpaidRows)}명.
          {overdue.length > 0
            ? ` 이 중 ${heads(overdue)}명은 24시간이 지났어요 — 자동 취소 대상입니다.`
            : " 24시간이 지나면 자동으로 취소되고 자리가 반환돼요."}
        </p>
      </div>
      <div className="h-4" />
    </div>
  );
}
