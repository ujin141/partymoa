import "server-only";

import type { User } from "@supabase/supabase-js";
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
 * 지금 로그인한 사람이 플랫폼 운영자인가. 돌려보내지 않고 참·거짓만 준다 —
 * 크루 화면에서 "운영 화면으로" 링크를 띄울지 정하는 데 쓴다.
 *
 * uuid 와 이메일 둘 다 본다. 구글로 로그인하면 새 사용자가 만들어져서
 * uuid 로만 보면 운영자가 아니게 된다.
 */
export async function isAdmin(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;

  const [{ data: byId }, { data: byMail }] = await Promise.all([
    supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    user.email
      ? supabase.from("admin_emails").select("email").ilike("email", user.email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return byId || byMail ? user : null;
}

/**
 * 운영자만 들여보낸다. 아니면 **운영자 전용 문**으로 돌려보낸다.
 *
 * 크루 로그인(`/crew/login`)과 섞지 않는다. 크루는 자기 파티만 보고,
 * 운영자는 전 크루의 매출과 수수료를 본다 — 권한이 다르면 문도 달라야
 * 어느 자격으로 들어와 있는지 헷갈리지 않는다.
 */
export async function requireAdmin(): Promise<User> {
  const user = await isAdmin();
  if (user) return user;

  const supabase = await createClient();
  const {
    data: { user: who },
  } = await supabase.auth.getUser();
  // 로그인은 했는데 운영자가 아닌 경우와 아예 안 한 경우를 구분해서 알려 준다
  redirect(who && !who.is_anonymous ? "/admin/login?denied=1" : "/admin/login");
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
