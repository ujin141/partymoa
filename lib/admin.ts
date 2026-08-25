import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Crew } from "@/types/database";

export interface PlatformRow {
  event_id: string;
  crew_id: string;
  title: string;
  starts_at: string;
  status: "draft" | "open" | "closed" | "done";
  crew_name: string;
  capacity: number;
  booked: number;
  revenue_paid: number;
  fee: number;
}

/**
 * 운영자인지. 아니면 돌려보낸다 — 화면마다 같은 검사를 다시 쓰지 않는다.
 *
 * uuid 와 이메일 둘 다 본다. 구글로 로그인하면 새 사용자가 만들어져서
 * uuid 로만 보면 운영자가 아니게 된다.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/crew/login?next=/admin");

  const [{ data: byId }, { data: byMail }] = await Promise.all([
    supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    user.email
      ? supabase.from("admin_emails").select("email").ilike("email", user.email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!byId && !byMail) redirect("/");
  return user;
}

/** 운영자가 보는 건 하나다 — 어느 크루가 얼마를 팔았고 수수료가 얼마인가 */
export async function platformRows(): Promise<PlatformRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_stats")
    .select("*")
    .order("starts_at", { ascending: false });
  return (data ?? []) as PlatformRow[];
}

export async function allCrews(): Promise<Crew[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crews")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Crew[];
}

export interface CrewRollup {
  crew: Crew;
  events: number;
  open: number;
  booked: number;
  revenue: number;
  fee: number;
}

export function rollup(crews: Crew[], rows: PlatformRow[]): CrewRollup[] {
  return crews
    .map((crew) => {
      const mine = rows.filter((r) => r.crew_id === crew.id);
      return {
        crew,
        events: mine.length,
        open: mine.filter((r) => r.status === "open").length,
        booked: mine.reduce((a, r) => a + r.booked, 0),
        revenue: mine.reduce((a, r) => a + Number(r.revenue_paid), 0),
        fee: mine.reduce((a, r) => a + Number(r.fee), 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
