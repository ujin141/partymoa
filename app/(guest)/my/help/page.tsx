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
    a: "기기를 바꾸거나 브라우저 기록을 지우면 연결이 끊깁니다. 내 티켓 화면에서 예매할 때 적은 이름과 연락처로 찾을 수 있습니다. 예매번호는 몰라도 됩니다.",
  },
  {
    q: "초대 코드가 뭔가요?",
    a: "DJ 나 호스트에게 받는 코드입니다. 예매할 때 넣으면 게스트 가격이 적용되고, 누구 초대로 왔는지 호스트가 알 수 있어요. 코드를 받지 않았다면 비워 두셔도 예매됩니다.",
  },
  {
    q: "테이블은 어떻게 잡나요?",
    a: "파티 상세의 테이블 칸을 보고 호스트 인스타로 문의하시면 됩니다. 앱에서는 결제하지 않습니다. 테이블을 잡으면 적힌 인원까지 입장비가 없습니다.",
  },
  {
    q: "환불하고 싶어요",
    a: "파티 시작 7일 전부터는 환불되지 않습니다. 인원에 맞춰 술·자리·인력을 미리 잡기 때문이에요. 그 전이라면 호스트가 기준에 따라 처리하니 파티 상세의 호스트로 연락해 주세요. 입금 전이라면 내 티켓에서 직접 취소할 수 있습니다.",
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
          여기서 안 풀리면 파티 상세의 호스트에게 직접 문의해 주세요.
          예매·환불은 호스트가 처리합니다.
        </p>
      </div>
    </>
  );
}
