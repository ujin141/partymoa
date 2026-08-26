"use client";

import { useEffect } from "react";

import { isNativeIOS, nativeSet } from "@/lib/native";

/**
 * 티켓을 앱에 남긴다.
 *
 * **입구에서 신호가 죽는다.** 지하 1층에 샤워실이 있는 건물이고, 정원이
 * 80명이면 그 앞에 다 몰린다. 그때 예매번호가 안 보이면 줄이 선다.
 *
 * 화면을 그리지 않는다. 티켓 목록이 뜰 때 그중 **하나만** 저장한다 —
 * 입구에서 필요한 건 오늘 들어갈 그 한 장이고, 목록을 통째로 넣으면
 * 지난 파티까지 따라다닌다.
 *
 * 앱이 아니면 아무 일도 안 한다. 브라우저에서는 window.Capacitor 가 없다.
 */
export type OfflineTicketData = {
  code: string;
  eventTitle: string;
  when: string;
  place: string;
  status: string;
};

export function OfflineTicket({ ticket }: { ticket: OfflineTicketData | null }) {
  useEffect(() => {
    if (!isNativeIOS()) return;
    // 티켓이 없으면 빈 값을 넣어 지운다. 취소한 티켓이 남아 있으면
    // 입구에서 그걸 내민다
    nativeSet("offlineTicket", ticket ?? null);
  }, [ticket]);

  return null;
}
