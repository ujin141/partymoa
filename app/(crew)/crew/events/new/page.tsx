import { redirect } from "next/navigation";

import { EventForm } from "@/components/crew/EventForm";
import { myCrew } from "@/lib/crew";

export const dynamic = "force-dynamic";
export const metadata = { title: "파티 등록" };

export default async function NewEventPage() {
  const crew = await myCrew();
  if (!crew) redirect("/crew/login");
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <EventForm />
    </div>
  );
}
