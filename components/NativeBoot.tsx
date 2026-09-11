"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { nativeHideSplash, onPushOpened } from "@/lib/native";

/**
 * 앱에서만 필요한 자잘한 것들. **아무것도 안 그린다.**
 *
 * 1. 스플래시 내리기 — 웹이 그려졌으니 로고를 붙들고 있을 이유가 없다
 * 2. 알림을 누르면 그 알림이 가리키는 화면으로 보내기
 *
 * **아무것도 안 그린다.** 셸 어디에 둬도 레이아웃을 안 건드린다.
 *
 * 웹은 sw.js 의 notificationclick 이 같은 일을 한다. 앱에는 그 짝이
 * 없어서, 서버가 url 을 담아 보내도 눌렀을 때 아무 일이 안 일어났다 —
 * 입금 확인 알림을 눌러도 쿠폰 칸으로 안 가고, 호스트가 예매 알림을
 * 눌러도 명단이 안 열렸다.
 *
 * **push() 가 아니라 replace() 다.** 알림으로 들어온 화면에서 뒤로
 * 가기를 누르면 그 전에 보던 곳으로 가야 한다. 알림을 누른 순간이
 * 방문 기록에 남으면 뒤로 가기가 제자리를 맴돈다.
 */
export function NativeBoot() {
  const router = useRouter();

  // 이 컴포넌트가 붙었다는 건 웹이 그려졌다는 뜻이다
  useEffect(() => {
    void nativeHideSplash();
  }, []);

  useEffect(() => onPushOpened((path) => router.replace(path)), [router]);

  return null;
}
