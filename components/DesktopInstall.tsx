"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Symbol } from "@/components/Symbol";
import { APP_STORE_URL } from "@/lib/store";

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
 *  2. 설치 — 아이폰은 App Store(2026-09 등록), 크롬·엣지는 웹앱 설치
 *
 * **없는 걸 있다고 하지 않는다.** 스토어에 올라가기 전에는 배지를
 * 안 달았다. 안드로이드는 아직 스토어에 없으니 웹앱 설치만 적는다.
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

  /**
   * **약관·방침 화면에서는 안 띄운다.** 이 두 화면은 스토어 심사자가
   * PC 로 열어서 읽는다. 가운데에 창이 뜨면 정책을 가린 것으로 보고
   * 그 자체가 반려 사유가 된다.
   */
  if (!show || path === "/privacy" || path === "/terms") return null;

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
          <>
            {/* 아이폰 앱이 스토어에 올라갔다. 홈 화면 추가보다 이게 먼저다 */}
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 text-[15px] font-bold text-white transition active:opacity-80"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                <path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3 0 1.7-.8 3.3-.8 1.5 0 2 .8 3.3.8 1.4 0 2.2-1.2 3.1-2.5.9-1.3 1.3-2.6 1.4-2.7-.1 0-2.8-1.1-2.8-4.2zM14 5.2c.7-.8 1.2-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1.1 3.1 1.1.1 2.3-.6 3-1.4z" />
              </svg>
              App Store 에서 받기
            </a>
            <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
              안드로이드는 크롬에서 <b className="text-ink">앱 설치</b>를 누르면
              홈 화면에 들어갑니다.
            </p>
          </>
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
