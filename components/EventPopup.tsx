"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  slug: string;
  title: string;
  cover: string;
  /** 9/26 (토) 22:00 — 26:10 */
  when: string;
  where: string;
  /** "9,900원부터" 같은 한 줄. 없으면 안 그린다 */
  price: string | null;
  /** 시작 화면(취향 고르기)을 아직 안 봤으면 그게 먼저다 */
  onboarded: boolean;
}

/**
 * 행사 팝업. 홈에 들어오면 가운데에 뜬다.
 *
 * **하루에 한 번이다.** "오늘 하루 안 보기" 를 누르면 자정까지 안 뜨고,
 * 그냥 닫으면 그 세션에서만 안 뜬다. 매번 뜨는 팝업은 광고가 아니라
 * 방해라서 앱을 지우게 만든다.
 *
 * 시작 화면이 뜰 차례면 양보한다. 창 두 개가 겹쳐 뜨면 둘 다 안 읽는다.
 *
 * 첫 페인트에는 안 그린다 — 본 사람인지는 브라우저만 안다.
 */
export function EventPopup(p: Props) {
  const [show, setShow] = useState(false);
  const key = `pm_popup_${p.slug}`;

  useEffect(() => {
    try {
      if (!p.onboarded && localStorage.getItem("pm_onboarded") !== "1") return;
      if (sessionStorage.getItem(key) === "1") return;
      const until = Number(localStorage.getItem(key) ?? 0);
      if (until > Date.now()) return;
    } catch {
      // 저장을 막아 둔 브라우저. 그럼 매번 뜨게 되니 아예 안 띄운다
      return;
    }
    setShow(true);
  }, [key, p.onboarded]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  function close(today: boolean) {
    try {
      if (today) {
        // 서울 자정까지. 로컬 자정으로 재면 해외에서 보는 사람만 어긋나는데
        // 그 정도는 괜찮다 — 어차피 하루 단위다
        const t = new Date();
        t.setHours(24, 0, 0, 0);
        localStorage.setItem(key, String(t.getTime()));
      } else {
        sessionStorage.setItem(key, "1");
      }
    } catch {
      // 무시
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      onClick={() => close(false)}
      role="presentation"
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0c10]/60 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={p.title}
        className="w-full max-w-[340px] overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(8,10,16,0.4)]"
      >
        {/* 커버에는 보통 제목이 이미 박혀 있다. 그 위에 또 쓰면 두 번 읽힌다 —
            글자는 사진 아래 흰 판에 둔다 */}
        <Link href={`/party/${p.slug}`} className="relative block aspect-[5/3] bg-soft">
          <Image
            src={p.cover}
            alt=""
            fill
            sizes="340px"
            priority
            className="object-cover"
          />
          <span className="absolute left-3.5 top-3.5 rounded bg-white/90 px-2 py-0.5 text-[11px] font-bold text-ink">
            예매 중
          </span>
        </Link>

        <div className="px-5 pt-4">
          <b className="block text-[21px] font-extrabold leading-tight">
            {p.title}
          </b>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
            {p.when}
            <br />
            {p.where}
          </p>
          {p.price ? (
            <b className="mt-2 block text-[17px] font-extrabold">{p.price}</b>
          ) : null}
        </div>

        <div className="p-4 pt-3.5">
          <Link
            href={`/party/${p.slug}`}
            className="block rounded-xl bg-brand py-3.5 text-center text-base font-bold text-white transition active:opacity-80"
          >
            예매하러 가기
          </Link>
          <div className="mt-2 flex items-center justify-between px-1 text-[13px] text-sub">
            <button type="button" onClick={() => close(true)} className="py-2">
              오늘 하루 안 보기
            </button>
            <button
              type="button"
              onClick={() => close(false)}
              className="py-2 font-semibold"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
