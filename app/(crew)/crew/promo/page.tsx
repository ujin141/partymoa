import { CrewPicker } from "@/components/crew/CrewPicker";
import { EventPicker } from "@/components/crew/EventPicker";
import { PromoKit } from "@/components/crew/PromoKit";
import { heads, live, money } from "@/lib/crew";
import { crewPage } from "@/lib/crew-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "홍보" };

export default async function CrewPromoPage({
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
          {`${crew.name} 에 등록한 파티가 없어요.`}
        </p>
      </div>
    );
  }

  const { event, stats, tiers, bookings, members } = current;
  const rows = live(bookings);

  // 멤버별 성과는 여기서 세어 넘긴다. 클라이언트로 예매 전부를 보내면
  // 홍보 화면에 손님 연락처가 실린다
  const withStats = members.map((m) => {
    const mine = rows.filter((b) => b.invite_code === m.invite_code);
    return { ...m, heads: heads(mine), revenue: money(mine) };
  });

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <CrewPicker crews={crews} current={crew.id} />
      <EventPicker events={events} current={event.id} />
      <PromoKit
        event={event}
        crewName={crew.name}
        tiers={tiers}
        members={withStats}
        booked={stats.booked}
        bookedF={stats.booked_f}
        bookedM={stats.booked_m}
      />
    </div>
  );
}
