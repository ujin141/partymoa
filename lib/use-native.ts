"use client";

import { useEffect, useState } from "react";

import { isNativeIOS } from "@/lib/native";

/**
 * 아이폰·아이패드 앱 안인지. **정해지기 전에는 null 이다.**
 *
 * `window.Capacitor` 는 서버에 없어서 첫 렌더에서는 알 수 없다.
 * false 로 시작하면 앱에서도 한 프레임 동안 웹용 화면이 그려진다 —
 * 그 한 프레임에 소셜 로그인 버튼이 보이면 심사에서 그대로 잡힌다
 * (가이드라인 4.8). 그래서 **모를 때는 null 을 주고, 부르는 쪽이
 * 아무것도 안 그리게 한다.**
 *
 *     const native = useNativeIOS();
 *     if (native !== false) return null;   // 웹인 게 확실할 때만 그린다
 */
export function useNativeIOS(): boolean | null {
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => setNative(isNativeIOS()), []);
  return native;
}
