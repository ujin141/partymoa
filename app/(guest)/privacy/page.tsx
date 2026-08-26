import Link from "next/link";

export const metadata = { title: "개인정보처리방침" };

/**
 * 개인정보처리방침.
 *
 * **실제로 하는 것만 적는다.** 안 하는 걸 적어 두면 그게 곧 거짓말이고,
 * 하는 걸 빠뜨리면 고지 의무 위반이다. 이 앱이 실제로 무엇을 받고
 * 누구에게 넘기는지 코드 기준으로 썼다.
 *
 * ⬛ 표시한 곳은 우진이 정해야 하는 값이다.
 */
const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: "1. 무엇을 받나요",
    body: (
      <>
        <p className="font-semibold text-ink">예매할 때</p>
        <ul>
          <li>이름 — 입금자 확인과 현장 입장 확인에 씁니다</li>
          <li>연락처 — 입금 안내와 변경 사항 연락에 씁니다</li>
          <li>
            성별 — <b className="text-ink">성비 조절에만</b> 씁니다. 남녀 각각
            정원의 절반까지 받는 파티가 있어서입니다. 다른 용도로 쓰지 않고,
            공개 화면에 개인 단위로 보이지 않습니다
          </li>
          <li>인원, 선택한 차수, 금액, 초대 코드</li>
        </ul>
        <p className="mt-3 font-semibold text-ink">로그인할 때</p>
        <ul>
          <li>
            카카오·구글·애플에서 받은 이메일. 티켓을 기기와 상관없이 보여 주는
            데 씁니다
          </li>
          <li>
            로그인하지 않아도 예매됩니다. 그때는 브라우저에 임시 식별자만
            둡니다
          </li>
        </ul>
        <p className="mt-3">
          결제 수단 정보는 받지 않습니다. 입금은 주최 크루 계좌로 직접
          이체하는 방식입니다.
        </p>
      </>
    ),
  },
  {
    h: "2. 누가 보나요",
    body: (
      <>
        <p>
          <b className="text-ink">예매한 파티의 주최 크루가 봅니다.</b> 이름,
          연락처, 인원, 차수, 금액, 입금·입장 상태를 봅니다. 입금을 확인하고
          현장에서 입장을 처리하려면 필요합니다.
        </p>
        <p className="mt-3">
          다른 크루는 볼 수 없습니다. 다른 손님도 볼 수 없습니다.
        </p>
        <p className="mt-3">
          파티모아 운영자는 입금 대조와 문의 처리를 위해 예매 기록을 볼 수
          있습니다. 그 밖의 용도로는 보지 않습니다.
        </p>
        <p className="mt-3">
          그 밖의 제3자에게 제공하지 않습니다. 법령에 따른 요청이 있을 때만
          예외입니다.
        </p>
      </>
    ),
  },
  {
    h: "3. 어디에 보관하나요",
    body: (
      <>
        <p>서비스를 돌리는 데 아래를 씁니다.</p>
        <ul>
          <li>Supabase — 데이터베이스와 로그인 (미국·아시아 리전)</li>
          <li>Vercel — 웹 호스팅</li>
        </ul>
        <p className="mt-3">
          두 곳 모두 저장과 전송에 암호화를 적용합니다.
        </p>
      </>
    ),
  },
  {
    h: "4. 얼마나 두나요",
    body: (
      <>
        <ul>
          <li>
            예매 기록 — 행사 종료 후 <b className="text-ink">⬛개월</b>. 정산과
            환불 분쟁에 대비해 둡니다
          </li>
          <li>
            자동 취소된 예매 — 취소 상태로 남습니다. 정원 계산의 근거라 바로
            지우지 않습니다
          </li>
          <li>계정 — 탈퇴하면 지웁니다</li>
        </ul>
      </>
    ),
  },
  {
    h: "5. 지워 달라고 할 수 있나요",
    body: (
      <>
        <p>
          열람·정정·삭제·처리정지를 요청할 수 있습니다. 아래로 연락 주세요.
        </p>
        <p className="mt-3">
          다만 이미 확정된 예매는 주최 크루의 정산 근거라, 행사가 끝나기 전에는
          삭제가 어려울 수 있습니다. 그 경우 이유를 알려 드립니다.
        </p>
      </>
    ),
  },
  {
    h: "6. 문의",
    body: (
      <>
        <p>
          개인정보 관련 문의는 <b className="text-ink">⬛이메일</b> 로 주세요.
        </p>
        <p className="mt-3">
          특정 파티의 예매·환불은 그 파티의 주최 크루가 처리합니다. 파티 상세
          화면에서 크루 연락처를 확인하세요.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">개인정보처리방침</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <p className="mb-6 text-[13px] leading-relaxed text-sub">
          파티모아는 파티 사전예매를 중개합니다. 아래는 실제로 받는 정보와 그
          쓰임을 적은 것입니다.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.h} className="mb-7">
            <h2 className="mb-2 text-[16px] font-extrabold">{s.h}</h2>
            <div className="text-[14px] leading-7 text-sub [&_li]:mt-1 [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}

        <p className="border-t border-line pt-5 text-[12.5px] leading-relaxed text-sub">
          이 방침이 바뀌면 이 화면에서 알립니다.
        </p>
        <div className="h-6" />
      </div>
    </>
  );
}
