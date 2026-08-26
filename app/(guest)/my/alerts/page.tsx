import Link from "next/link";

import { PushToggle } from "@/components/PushToggle";
import { HOLD_HOURS } from "@/lib/rules";

export const metadata = { title: "알림 설정" };

const WHAT = [
  {
    t: "입금 확인",
    d: "크루가 입금을 확인하면 바로 알려 드려요. 확정됐는지 다시 물어볼 필요가 없어요.",
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
export default function AlertsPage() {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

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
          광고는 안 보냅니다. 예매한 건에 대해서만, 아래 세 가지만 갑니다.
        </p>

        <div className="mb-7 mt-6">
          {WHAT.map((w) => (
            <div key={w.t} className="border-b border-line py-3.5 last:border-b-0">
              <b className="text-[15px] font-extrabold">{w.t}</b>
              <p className="mt-1 text-[13px] leading-relaxed text-sub">{w.d}</p>
            </div>
          ))}
        </div>

        <PushToggle vapid={vapid} />

        {!vapid ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
            아직 알림 키가 설정되지 않았어요. 배포 환경변수에
            NEXT_PUBLIC_VAPID_PUBLIC_KEY 를 넣으면 켜집니다.
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
