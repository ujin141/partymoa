"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

const OFF_KEY = "partymoa:anon-off";

/**
 * 익명 로그인. **로그인 화면 없이 내 티켓이 돌게 하는 장치다.**
 *
 * 예매는 로그인 없이 받는다(첫 목표는 "링크로 들어와 예매"다). 그런데
 * 내 티켓을 보여 주려면 이 사람이 누구인지 서버가 알아야 하고, 그걸
 * localStorage 에 예매 내역을 쌓아 해결하면 기기를 바꾸는 순간 사라진다.
 *
 * 그래서 첫 방문에 익명 세션을 만든다. bookings.user_id 가 채워지고
 * RLS 가 "본인 예매만" 을 그대로 보장한다.
 *
 * 프로젝트에서 익명 로그인을 안 켰으면 422 가 돌아온다. 그때는 한 번만
 * 겪고 접는다 — 페이지를 넘길 때마다 재시도하면 콘솔이 빨갛게 차고,
 * 진짜 오류가 그 사이에 묻힌다.
 */
export function EnsureSession() {
  useEffect(() => {
    if (sessionStorage.getItem(OFF_KEY)) return;

    const supabase = createClient();
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) sessionStorage.setItem(OFF_KEY, "1");
    });
  }, []);
  return null;
}
