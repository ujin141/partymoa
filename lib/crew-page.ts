import "server-only";

import { redirect } from "next/navigation";

import { adminEvent, crewEvents, myCrew, type AdminEvent } from "@/lib/crew";
import type { Crew, EventRow } from "@/types/database";

export interface CrewPageData {
  crew: Crew;
  events: EventRow[];
  current: AdminEvent | null;
}

/**
 * 크루 화면 네 개가 똑같이 하는 일 — 로그인 확인, 행사 목록, 선택된 행사.
 * 네 군데에 복사해 두면 한 곳만 고치는 실수가 난다.
 */
export async function crewPage(
  searchParams: Promise<{ e?: string }>,
): Promise<CrewPageData> {
  const crew = await myCrew();
  if (!crew) redirect("/crew/login");

  const [{ e }, events] = await Promise.all([
    searchParams,
    crewEvents(crew.id),
  ]);
  if (!events.length) return { crew, events, current: null };

  const id = events.some((x) => x.id === e) ? e! : events[0].id;
  return { crew, events, current: await adminEvent(id) };
}
