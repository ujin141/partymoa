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
 * 이 앱은 폰 폭(430px)에 맞춰져 있어서 PC 로 열면 제대로 못 쓴다.
 * **화면 한가운데에 띄운다** — 구석에 두면 아무도 안 본다.
 *
 * 대신 닫는 길을 넉넉히 둔다. 배경을 눌러도, Esc 를 눌러도, 아래
 * "PC 에서 볼게요" 를 눌러도 닫힌다. 닫을 방법이 잘 안 보이는 창이
 * 가운데에 뜨면 그게 제일 미움받는다.
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("keydown", onKey);
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
    <div
      onClick={close}
      role="presentation"
      className="fixed inset-0 z-50 hidden items-center justify-center bg-[#0a0c10]/55 p-6 backdrop-blur-[2px] lg:flex"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="폰으로 열기"
        className="relative w-[380px] rounded-3xl bg-white p-7 text-center shadow-[0_30px_80px_rgba(8,10,16,0.35)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[19px] leading-none text-[#B4B8C2] transition hover:bg-soft"
        >
          ×
        </button>

        <div className="flex justify-center">
          <Symbol size={38} />
        </div>
        <b className="mt-3.5 block text-[20px] font-extrabold leading-snug">
          폰에서 쓰는 앱이에요
        </b>
        <p className="mt-2 text-[13.5px] leading-relaxed text-sub">
          예매하고 티켓을 꺼내는 건 결국 현장에서예요.
          <br />
          폰으로 열어 두면 입장할 때 바로 보여 줄 수 있어요.
        </p>

        <div className="mt-5 rounded-2xl bg-soft p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr?p=${encodeURIComponent(path)}`}
            alt="폰으로 열기 QR"
            width={150}
            height={150}
            className="mx-auto h-[150px] w-[150px]"
          />
          <p className="mt-3.5 text-[12.5px] leading-relaxed text-sub">
            폰 카메라로 찍으면{" "}
            <b className="text-ink">지금 보던 이 화면</b>이 열려요.
          </p>
        </div>

        {installed ? (
          <p className="mt-4 rounded-xl bg-[#E7F7EF] px-4 py-3 text-[13px] font-semibold text-ok">
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
            className="mt-4 w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white"
          >
            이 컴퓨터에 설치
          </button>
        ) : (
          <p className="mt-4 text-[12.5px] leading-relaxed text-sub">
            아이폰은 사파리에서{" "}
            <b className="text-ink">공유 → 홈 화면에 추가</b>, 안드로이드는
            크롬에서 <b className="text-ink">앱 설치</b>를 누르면 홈 화면에
            들어갑니다.
          </p>
        )}

        <button
          type="button"
          onClick={close}
          className="mt-3 w-full py-2 text-[13.5px] font-semibold text-sub underline"
        >
          PC 에서 볼게요
        </button>
      </aside>
    </div>
  );
}
