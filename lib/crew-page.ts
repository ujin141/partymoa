import "server-only";

import { redirect } from "next/navigation";

import {
  adminEvent,
  crewEvents,
  myCrews,
  type AdminEvent,
} from "@/lib/crew";
import type { Crew, EventRow } from "@/types/database";

export interface CrewPageData {
  /** 지금 보고 있는 크루 */
  crew: Crew;
  /** 이 사람이 속한 크루 전부. 하나면 고르는 줄을 안 띄운다 */
  crews: Crew[];
  events: EventRow[];
  current: AdminEvent | null;
}

/**
 * 크루 화면들이 똑같이 하는 일 — 로그인 확인, 크루 고르기, 행사 고르기.
 * 여러 군데에 복사해 두면 한 곳만 고치는 실수가 난다.
 *
 * 크루는 `?c=`, 행사는 `?e=` 로 고른다. **고른 크루가 내 것인지 반드시
 * 확인한다** — 주소창에 남의 crew id 를 넣어도 안 열려야 한다.
 * RLS 가 데이터는 막지만, 그러면 빈 화면이 뜰 뿐 왜 빈지는 안 보인다.
 */
export async function crewPage(
  searchParams: Promise<{ c?: string; e?: string }>,
): Promise<CrewPageData> {
  const [{ c, e }, crews] = await Promise.all([searchParams, myCrews()]);
  if (!crews.length) redirect("/crew/login");

  const crew = crews.find((x) => x.id === c) ?? crews[0];
  const events = await crewEvents(crew.id);
  if (!events.length) return { crew, crews, events, current: null };

  const id = events.some((x) => x.id === e) ? e! : events[0].id;
  return { crew, crews, events, current: await adminEvent(id) };
}
