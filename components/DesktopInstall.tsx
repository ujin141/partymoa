"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Symbol } from "@/components/Symbol";

/** 크롬·엣지가 설치 가능할 때 주는 이벤트. 타입 정의에 아직 없다 */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * PC 로 들어온 사람에게 폰으로 옮겨 가라고 말한다.
 *
 * 이 앱은 폰 폭(430px)에 맞춰져 있어서 PC 로 열면 가운데 좁은 띠만
 * 쓰고 양옆이 텅 빈다. **그 빈자리에 띄운다** — 화면을 덮는 모달로
 * 만들면 둘러보러 온 사람을 쫓아낸다.
 *
 * 파는 건 두 가지다.
 *  1. QR — 폰으로 지금 보던 그 화면을 그대로 연다. 주소를 옮겨 적게
 *     하면 아무도 안 한다
 *  2. 설치 — 크롬·엣지는 웹앱을 진짜로 설치해 준다. 아직 스토어 앱이
 *     없으니 이게 제일 앱에 가깝다
 *
 * **없는 걸 있다고 하지 않는다.** 앱스토어 배지를 달아 두면 눌러 보고
 * 없는 걸 알게 된다. 지금 되는 것만 적는다.
 */
export function DesktopInstall() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 폰·태블릿에는 안 띄운다. 이미 폰으로 보고 있으니 할 말이 없다
    const wide =
      window.matchMedia("(min-width: 900px)").matches &&
      window.matchMedia("(pointer: fine)").matches;
    // 이미 설치해서 앱처럼 띄운 창
    const standalone = window.matchMedia("(display-mode: standalone)").matches;

    let closed = false;
    try {
      closed = sessionStorage.getItem("pm_pc_closed") === "1";
    } catch {
      // 저장을 막아 둔 브라우저. 그러면 매번 띄우지 않고 그냥 안 띄운다
      closed = true;
    }
    if (wide && !standalone && !closed) setShow(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  function close() {
    // 세션에만 남긴다. 영영 안 뜨게 하면 다음에 설치하고 싶어도 길이 없다
    try {
      sessionStorage.setItem("pm_pc_closed", "1");
    } catch {
      // 무시
    }
    setShow(false);
  }

  return (
    <aside className="fixed bottom-6 right-6 z-40 hidden w-[320px] rounded-2xl border border-line bg-white p-5 shadow-[0_18px_50px_rgba(16,18,29,0.16)] lg:block">
      <button
        type="button"
        onClick={close}
        aria-label="닫기"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-[17px] leading-none text-[#B4B8C2] transition hover:bg-soft"
      >
        ×
      </button>

      <div className="flex items-center gap-2">
        <Symbol size={22} />
        <b className="text-[15px] font-extrabold">폰에서 쓰는 앱이에요</b>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
        예매하고 티켓을 꺼내는 건 결국 현장에서예요. 폰으로 열어 두면
        입장할 때 바로 보여 줄 수 있어요.
      </p>

      <div className="mt-4 flex items-center gap-3.5 rounded-xl bg-soft p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr?p=${encodeURIComponent(path)}`}
          alt="폰으로 열기 QR"
          width={84}
          height={84}
          className="h-[84px] w-[84px] flex-none"
        />
        <p className="text-[12.5px] leading-relaxed text-sub">
          폰 카메라로 찍으면
          <br />
          <b className="text-ink">지금 보던 이 화면</b>이 열려요.
        </p>
      </div>

      {installed ? (
        <p className="mt-3.5 rounded-xl bg-[#E7F7EF] px-3.5 py-2.5 text-[12.5px] font-semibold text-ok">
          설치했어요. 이제 앱처럼 열립니다.
        </p>
      ) : prompt ? (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
          className="mt-3.5 w-full rounded-xl bg-brand py-3 text-[14px] font-bold text-white"
        >
          이 컴퓨터에 설치
        </button>
      ) : (
        <p className="mt-3.5 text-[12px] leading-relaxed text-sub">
          아이폰은 사파리에서 <b className="text-ink">공유 → 홈 화면에 추가</b>,
          안드로이드는 크롬에서 <b className="text-ink">앱 설치</b>를 누르면
          홈 화면에 들어갑니다.
        </p>
      )}
    </aside>
  );
}
