import { EventPicker } from "@/components/crew/EventPicker";
import { GuestList } from "@/components/crew/GuestList";
import { crewPage } from "@/lib/crew-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "명단" };

export default async function CrewListPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { events, current } = await crewPage(searchParams);
  if (!current) {
    return (
      <p className="flex-1 px-6 py-16 text-center text-sm text-sub">
        등록한 파티가 없어요.
      </p>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <EventPicker events={events} current={current.event.id} />
      <GuestList
        bookings={current.bookings}
        tiers={current.tiers}
        eventTitle={current.event.title}
        bankAccount={current.event.bank_account}
      />
    </div>
  );
}
