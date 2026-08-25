import Link from "next/link";

export const metadata = { title: "고객센터" };

const QA = [
  {
    q: "입금은 어떻게 하나요?",
    a: "예매하면 내 티켓에 계좌가 뜹니다. 입금자명은 예매번호와 이름을 함께 적어 주세요. 이름만 넣으면 확인이 늦어집니다.",
  },
  {
    q: "24시간 안에 입금 못 하면요?",
    a: "자동으로 취소되고 자리가 다음 사람에게 넘어갑니다. 다시 예매하시면 됩니다.",
  },
  {
    q: "왜 성별을 물어보나요?",
    a: "성비를 맞추는 파티가 있어서입니다. 남녀 각각 정원의 절반까지만 받고, 한쪽이 차면 그 성별 예매가 닫힙니다. 이 정보는 그 용도로만 씁니다.",
  },
  {
    q: "혼자 가도 되나요?",
    a: "1인 참여 환영 표시가 붙은 파티는 혼자 오는 손님을 전제로 준비합니다. 예매할 때 1명을 고르면 됩니다.",
  },
  {
    q: "티켓이 안 보여요",
    a: "기기를 바꾸거나 브라우저 기록을 지우면 연결이 끊깁니다. 내 티켓 화면에서 예매번호와 연락처로 찾을 수 있습니다.",
  },
  {
    q: "환불하고 싶어요",
    a: "환불은 주최 크루가 처리합니다. 파티 상세에 있는 크루로 직접 연락해 주세요.",
  },
];

export default function HelpPage() {
  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">고객센터</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {QA.map((x) => (
          <details key={x.q} className="border-b border-line px-4 py-4">
            <summary className="cursor-pointer list-none text-[15px] font-bold">
              {x.q}
            </summary>
            <p className="mt-2.5 text-[14px] leading-7 text-sub">{x.a}</p>
          </details>
        ))}
        <p className="px-4 py-6 text-[12.5px] leading-relaxed text-sub">
          여기서 안 풀리면 파티 상세의 주최 크루에게 직접 문의해 주세요.
          예매·환불은 크루가 처리합니다.
        </p>
      </div>
    </>
  );
}
