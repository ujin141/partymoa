import { CheckinList } from "@/components/crew/CheckinList";
import { CrewPicker } from "@/components/crew/CrewPicker";
import { EventPicker } from "@/components/crew/EventPicker";
import { crewPage } from "@/lib/crew-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "입장 확인" };

export default async function CrewCheckinPage({
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
      <CheckinList bookings={current.bookings}
        tables={current.tables} eventId={current.event.id} />
    </div>
  );
}
