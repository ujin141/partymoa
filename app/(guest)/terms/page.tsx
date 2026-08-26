import Link from "next/link";

import { FEE_RATE, HOLD_HOURS, REFUND_CUTOFF_DAYS } from "@/lib/rules";

export const metadata = { title: "이용약관" };

/**
 * 이용약관.
 *
 * **파티모아는 중개자다.** 파티를 여는 건 크루이고, 계약은 손님과 크루
 * 사이에 생긴다. 이걸 흐리게 적어 두면 환불 분쟁이 전부 우리한테 온다.
 *
 * 수수료율과 미입금 마감은 코드에서 가져온다 — 문서와 실제가 어긋나면
 * 그게 제일 나쁘다.
 */
export default function TermsPage() {
  const fee = Math.round(FEE_RATE * 100);

  const SECTIONS: { h: string; body: React.ReactNode }[] = [
    {
      h: "1. 파티모아가 하는 일",
      body: (
        <>
          <p>
            파티모아는 파티를 여는 호스트와 가려는 사람을 잇는{" "}
            <b className="text-ink">중개 서비스</b>입니다. 파티를 직접 열지
            않습니다.
          </p>
          <p className="mt-3">
            파티의 내용·장소·시간·가격·운영은 호스트가 정하고 책임집니다.
            예매가 확정되면 계약은{" "}
            <b className="text-ink">손님과 호스트 사이</b>에 생깁니다.
          </p>
        </>
      ),
    },
    {
      h: "2. 예매와 입금",
      body: (
        <ul>
          <li>예매를 신청하면 자리가 잡히고 입금 안내가 뜹니다</li>
          <li>
            <b className="text-ink">{HOLD_HOURS}시간</b> 안에 입금하지 않으면
            자동 취소되고 그 자리는 다음 사람에게 넘어갑니다
          </li>
          <li>
            입금자명은 예매번호와 이름을 함께 적어야 합니다. 확인이 늦어지는
            책임은 넣지 않은 쪽에 있습니다
          </li>
          <li>
            성비를 조절하는 파티는 남녀 각각 정원의 절반까지 받습니다. 한쪽이
            차면 그 성별 예매가 닫힙니다
          </li>
          <li>정원·차수는 서버에서 확인합니다. 초과 예매는 생기지 않습니다</li>
        </ul>
      ),
    },
    {
      h: "3. 환불",
      body: (
        <>
          <p>
            <b className="text-ink">
              파티 시작 {REFUND_CUTOFF_DAYS}일 전부터는 환불되지 않습니다.
            </b>{" "}
            파티는 인원에 맞춰 술·자리·인력을 미리 잡습니다. 코앞에서 빠지면
            그 비용이 그대로 남습니다.
          </p>
          <p className="mt-3">
            그 전에 취소하는 경우의 기준은 호스트가 정합니다. 파티 상세
            화면의 호스트 연락처로 문의하세요.
          </p>
          <p className="mt-3">
            입금 전 예매는 언제든 손님이 직접 취소할 수 있습니다. 돌려드릴
            돈이 없고, 빨리 빼 주는 편이 다음 사람에게 자리가 갑니다.
          </p>
          <p className="mt-3">
            파티모아는 입금을 대신 받지 않습니다. 돈은 호스트 계좌로 직접
            들어갑니다.
          </p>
        </>
      ),
    },
    {
      h: "4. 수수료",
      body: (
        <p>
          파티모아는 <b className="text-ink">입금이 확인된 티켓</b>에 한해
          금액의 {fee}%를 호스트에게 수수료로 청구합니다. 손님이 따로 내는 돈은
          없습니다.
        </p>
      ),
    },
    {
      h: "5. 하면 안 되는 것",
      body: (
        <ul>
          <li>남의 이름·연락처로 예매하는 것</li>
          <li>되팔 목적으로 자리를 잡아 두는 것</li>
          <li>커뮤니티에 광고·도배·타인 비방을 올리는 것</li>
          <li>서비스를 자동으로 긁거나 부하를 거는 것</li>
        </ul>
      ),
    },
    {
      h: "6. 호스트의 의무",
      body: (
        <ul>
          <li>파티 정보를 사실대로 적을 것</li>
          <li>받은 손님 정보를 그 파티 운영 외에 쓰지 않을 것</li>
          <li>취소·변경이 생기면 예매자에게 바로 알릴 것</li>
          <li>환불 기준을 미리 밝히고 지킬 것</li>
        </ul>
      ),
    },
    {
      h: "7. 책임의 한계",
      body: (
        <>
          <p>
            파티모아는 중개자로서 예매 시스템을 제공합니다. 파티 현장에서
            생기는 일, 호스트와 손님 사이의 분쟁, 호스트가 파티를 취소하거나
            내용을 바꾸는 것에 대해서는 책임지지 않습니다.
          </p>
          <p className="mt-3">
            다만 예매 시스템 자체의 잘못(중복 예매, 금액 오류 등)은 파티모아가
            바로잡습니다.
          </p>
        </>
      ),
    },
    {
      h: "8. 문의",
      body: (
        <p>
          서비스 문의는{" "}
          <a href="mailto:ujin141@naver.com" className="font-bold text-brand underline">
            ujin141@naver.com
          </a>{" "}
          로 주세요. 특정
          파티의 예매·환불은 그 파티의 호스트에게 직접 문의하세요.
        </p>
      ),
    },
  ];

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">이용약관</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        {SECTIONS.map((s) => (
          <section key={s.h} className="mb-7">
            <h2 className="mb-2 text-[16px] font-extrabold">{s.h}</h2>
            <div className="text-[14px] leading-7 text-sub [&_li]:mt-1 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
        <div className="h-6" />
      </div>
    </>
  );
}
