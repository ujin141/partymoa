import Link from "next/link";

import { MarketingToggle } from "@/components/MarketingToggle";
import { PushToggle } from "@/components/PushToggle";
import { apnsReady } from "@/lib/apns";
import { HOLD_HOURS } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "알림 설정" };

const WHAT = [
  {
    t: "입금 확인",
    d: "호스트가 입금을 확인하면 바로 알려 드려요. 확정됐는지 다시 물어볼 필요가 없어요.",
  },
  {
    t: "자리가 풀리기 전",
    d: `입금 마감 세 시간 전에 한 번만 알려 드려요. ${HOLD_HOURS}시간이 지나면 자리가 다음 사람에게 넘어갑니다.`,
  },
  {
    t: "파티 당일",
    d: "그날 아침에 시간과 장소를 알려 드려요.",
  },
];

/**
 * 알림 설정.
 *
 * **무엇을 보내는지 먼저 적는다.** "알림 켜기" 만 있는 화면에서 켜는
 * 사람은 거의 없다. 광고가 올까 봐 안 켠다.
 */
export default async function AlertsPage() {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  /**
   * 아이폰 앱은 웹푸시가 아니라 APNs 로 받는다. 서버에 .p8 키가 없으면
   * **보낼 수가 없다** — 그런데도 켜기 버튼을 두면 손님이 눌렀다가
   * 실패만 본다. 보낼 수 있을 때만 버튼을 준다.
   */
  const apns = apnsReady();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  /**
   * **칸이 있는지를 사람과 따로 본다.**
   *
   * 처음 들어온 손님은 서버가 그릴 때 아직 익명 세션이 없다. 사람이
   * 있어야만 스위치를 띄우게 했더니 첫 방문에 스위치가 안 보였다 —
   * 정작 그때 켜라고 만든 화면인데.
   *
   * 칸이 없으면(PUSH_ADS.sql 미실행) 안 띄운다. 눌러도 안 되는 스위치를
   * 보여 주는 건 더 나쁘다.
   */
  const { error: colErr } = await supabase
    .from("profiles")
    .select("marketing_push")
    .limit(1);
  const marketingReady = !colErr;

  let marketing = false;
  if (user && marketingReady) {
    const { data } = await supabase
      .from("profiles")
      .select("marketing_push")
      .eq("user_id", user.id)
      .maybeSingle();
    marketing = Boolean(data?.marketing_push);
  }

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">알림</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <h1 className="text-[21px] font-extrabold leading-snug">
          예매한 파티만
          <br />
          알려 드려요
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
          예매한 건에 대해서만, 아래 세 가지만 갑니다. 광고는 아래에서 따로
          동의한 분께만 보냅니다.
        </p>

        <div className="mb-7 mt-6">
          {WHAT.map((w) => (
            <div key={w.t} className="border-b border-line py-3.5 last:border-b-0">
              <b className="text-[15px] font-extrabold">{w.t}</b>
              <p className="mt-1 text-[13px] leading-relaxed text-sub">{w.d}</p>
            </div>
          ))}
        </div>

        <PushToggle vapid={vapid} apnsReady={apns} />

        {vapid && marketingReady ? (
          <MarketingToggle initial={marketing} />
        ) : null}

        {!vapid ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
            아직 알림 키가 설정되지 않았어요. 배포 환경변수에
            NEXT_PUBLIC_VAPID_PUBLIC_KEY 를 넣고 **캐시 없이 다시
            빌드하면** 켜집니다. 값은 빌드할 때 코드에 박히기 때문에,
            변수만 넣고 재배포하면 예전 결과물이 그대로 나갑니다.
          </p>
        ) : (
          <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
            기기마다 따로 켜야 해요. 폰과 노트북에서 각각 켜면 양쪽으로
            갑니다.
          </p>
        )}
      </div>
    </>
  );
}
