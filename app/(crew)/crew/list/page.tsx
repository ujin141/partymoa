import { CrewPicker } from "@/components/crew/CrewPicker";
import { EventPicker } from "@/components/crew/EventPicker";
import { GuestList } from "@/components/crew/GuestList";
import { crewPage } from "@/lib/crew-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "명단" };

export default async function CrewListPage({
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
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <CrewPicker crews={crews} current={crew.id} />
      <EventPicker events={events} current={current.event.id} />
      <GuestList
        bookings={current.bookings}
        tiers={current.tiers}
        members={current.members}
        eventTitle={current.event.title}
        bankAccount={current.event.bank_account}
        guestPrice={current.event.guest_price}
        maleMultiplier={Number(current.event.male_price_multiplier)}
      />
    </div>
  );
}
