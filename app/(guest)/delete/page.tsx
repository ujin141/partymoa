import Link from "next/link";

import { DeleteAccount } from "@/components/DeleteAccount";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "계정 삭제" };

const MAIL = "ujin141@naver.com";

/**
 * 계정 삭제 안내.
 *
 * **구글 플레이가 이 주소를 요구한다.** 계정을 만들 수 있는 앱은
 * 로그인 없이 열리는 곳에 "어떻게 지우는지" 가 적혀 있어야 한다.
 * 그래서 이 화면은 로그인 여부와 상관없이 열린다.
 *
 * **다 지운다고 적지 않는다.** 확정된 예매는 크루의 정산 근거라
 * 바로 못 지운다. 그걸 숨기고 "전부 삭제" 라고 적으면 그게 거짓말이
 * 되고, 심사에서도 방침과 어긋난다고 잡힌다. 남는 게 무엇이고
 * 언제까지인지 그대로 적는다.
 */
export default async function DeletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user && !user.is_anonymous);

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">계정 삭제</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <p className="text-[14px] leading-7 text-sub">
          파티모아 계정과 거기에 딸린 정보를 지웁니다. 앱에서 바로 할 수
          있고, 로그인이 안 되는 상황이면 메일로 요청해도 됩니다.
        </p>

        <section className="mt-7">
          <h2 className="mb-2 text-[16px] font-extrabold">바로 지우는 것</h2>
          <ul className="list-disc pl-5 text-[14px] leading-7 text-sub">
            <li>로그인 계정과 이메일</li>
            <li>프로필 — 이름, 관심 지역, 좋아하는 장르</li>
            <li>찜한 파티, 팔로우한 크루</li>
            <li>커뮤니티 글과 댓글</li>
            <li>파티 후기</li>
            <li>알림 수신 설정</li>
            <li>취소된 예매 기록</li>
          </ul>
        </section>

        <section className="mt-7">
          <h2 className="mb-2 text-[16px] font-extrabold">남는 것</h2>
          <p className="text-[14px] leading-7 text-sub">
            입금이 확인됐거나 아직 진행 중인 예매는 계정에서 떼어 내지만
            줄 자체는 남습니다. 주최 크루의 정산 근거이고 환불 분쟁이
            남아 있어서입니다.
          </p>
          <p className="mt-3 text-[14px] leading-7 text-sub">
            그 줄에 적힌 이름과 연락처는{" "}
            <b className="text-ink">행사가 끝나고 6개월 뒤</b>에 지웁니다.
            그 뒤에는 몇 명이 왔는지만 숫자로 남습니다.
          </p>
          <p className="mt-3 text-[14px] leading-7 text-sub">
            아직 안 지난 파티가 있다면 예매를 먼저 취소하고 지우는 쪽이
            깔끔합니다. 입금 전이라면{" "}
            <Link href="/tickets" className="underline">
              내 티켓
            </Link>
            에서 직접 취소할 수 있습니다.
          </p>
        </section>

        <section className="mt-8">
          {signedIn ? (
            <DeleteAccount />
          ) : (
            <>
              <Link
                href="/login?next=/delete"
                className="block rounded-xl bg-ink py-3.5 text-center text-[15px] font-bold text-white"
              >
                로그인하고 삭제하기
              </Link>
              <p className="mt-3 text-[13px] leading-7 text-sub">
                로그인이 안 되면{" "}
                <a
                  href={`mailto:${MAIL}?subject=${encodeURIComponent("파티모아 계정 삭제 요청")}`}
                  className="font-bold text-brand underline"
                >
                  {MAIL}
                </a>{" "}
                로 예매할 때 쓴 이름과 연락처를 적어 보내 주세요. 확인하고
                지운 뒤 답장드립니다.
              </p>
            </>
          )}
        </section>

        <p className="mt-8 border-t border-line pt-5 text-[12.5px] leading-relaxed text-sub">
          어떤 정보를 어떻게 다루는지는{" "}
          <Link href="/privacy" className="underline">
            개인정보처리방침
          </Link>
          에 적어 두었습니다.
        </p>
        <div className="h-6" />
      </div>
    </>
  );
}
