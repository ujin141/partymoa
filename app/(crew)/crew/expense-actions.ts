"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function addExpense(
  eventId: string,
  label: string,
  amount: number,
  kind: "expense" | "income" = "expense",
) {
  if (!label.trim() || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: "항목과 금액을 확인해 주세요." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("event_expenses").insert({
    event_id: eventId,
    label: label.trim(),
    amount: Math.round(amount),
    kind,
    sort_order: Date.now() % 100000,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/crew/settle");
  return { ok: true };
}

export async function removeExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_expenses")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/crew/settle");
  return { ok: true };
}
