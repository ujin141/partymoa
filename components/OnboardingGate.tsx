"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Onboarding = dynamic(
  () => import("@/components/Onboarding").then((m) => m.Onboarding),
  { ssr: false },
);

/**
 * 시작 화면을 띄울지 정한다.
 *
 * **서버에서 정하지 않는다.** 로그인 안 한 사람은 브라우저에만 본 표시가
 * 남아서, 서버가 렌더한 HTML 로 판단하면 이미 본 사람에게도 한 번 깜빡
 * 하고 사라진다. 그게 매번 뜨는 것보다 더 이상해 보인다.
 *
 * 그래서 처음 페인트에서는 아무것도 안 그리고, 브라우저에서 확인한 뒤에만
 * 얹는다.
 */
export function OnboardingGate({
  signedIn,
  onboarded,
  areas,
  categories,
}: {
  signedIn: boolean;
  onboarded: boolean;
  areas: string[];
  categories: string[];
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (onboarded) return;
    let seen = false;
    try {
      seen = localStorage.getItem("pm_onboarded") === "1";
    } catch {
      // 저장을 막아 둔 브라우저. 그럴 땐 안 띄운다 — 매번 뜨는 것보다 낫다
      seen = true;
    }
    if (!seen) setShow(true);
  }, [onboarded]);

  if (!show) return null;
  return (
    <Onboarding
      signedIn={signedIn}
      initialAreas={areas}
      initialCategories={categories}
    />
  );
}
