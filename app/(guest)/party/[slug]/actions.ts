"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * 후기 남기기.
 *
 * **예매한 사람만, 파티가 시작한 뒤에만.** 검사는 DB 의 can_review()
 * 가 한다 — 여기서 한 번 더 세면 두 군데가 어긋나고, 어긋나면 서버가
 * 아니라 화면이 이긴 것처럼 보인다.
 *
 * 여기서는 값만 다듬고, 막히면 그 이유를 사람 말로 옮긴다.
 */
export async function writeReview(input: {
  eventId: string;
  slug: string;
  rating: number;
  body: string;
  nickname: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return { ok: false as const, message: "먼저 로그인해 주세요." };
  }

  const body = input.body.trim();
  const nickname = input.nickname.trim() || "익명";
  if (body.length < 5) {
    return { ok: false as const, message: "후기를 다섯 자 이상 적어 주세요." };
  }
  if (body.length > 1000) {
    return { ok: false as const, message: "후기는 1000자까지예요." };
  }
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false as const, message: "별점을 골라 주세요." };
  }

  const { error } = await supabase.from("reviews").insert({
    event_id: input.eventId,
    user_id: user.id,
    rating: input.rating,
    body,
    nickname: nickname.slice(0, 20),
  });

  if (error) {
    // 23505 = 이미 하나 썼다. 42501 / RLS 거부 = 자격이 없다
    if (error.code === "23505") {
      return { ok: false as const, message: "이미 후기를 남기셨어요." };
    }
    return {
      ok: false as const,
      message:
        "이 파티는 후기를 남길 수 없어요. 예매한 계정으로 로그인했는지, 파티가 시작했는지 확인해 주세요.",
    };
  }

  revalidatePath(`/party/${input.slug}`);
  revalidatePath("/tickets");
  return { ok: true as const };
}
