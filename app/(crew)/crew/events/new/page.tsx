import { redirect } from "next/navigation";

import { EventForm } from "@/components/crew/EventForm";
import { myCrews } from "@/lib/crew";

export const dynamic = "force-dynamic";
export const metadata = { title: "파티 등록" };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ c }, crews] = await Promise.all([searchParams, myCrews()]);
  if (!crews.length) redirect("/crew/login");
  const crew = crews.find((x) => x.id === c) ?? crews[0];

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <EventForm crewId={crew.id} crewName={crew.name} />
    </div>
  );
}
