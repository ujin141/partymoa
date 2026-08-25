"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // NEXT_PUBLIC_ 은 빌드 때 박힌다. 빌드 뒤에 환경변수를 넣으면
    // 다시 배포해야 반영된다 — 여기서 그걸 알려 준다
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 빌드에 안 들어갔습니다. " +
        "Vercel 환경변수를 넣은 뒤 다시 배포하세요.",
    );
  }
  return createBrowserClient<Database>(url, key);
}
