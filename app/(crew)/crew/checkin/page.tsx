import { CheckinList } from "@/components/crew/CheckinList";
import { EventPicker } from "@/components/crew/EventPicker";
import { crewPage } from "@/lib/crew-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "입장 확인" };

export default async function CrewCheckinPage({
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
      <CheckinList bookings={current.bookings} eventId={current.event.id} />
    </div>
  );
}
