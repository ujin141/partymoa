"use client";

import Image from "next/image";
import { useState } from "react";

import type { EventPhoto } from "@/types/database";

/**
 * 파티 사진.
 *
 * 커버 한 장으로는 어떤 파티인지 안 전해진다. 낮의 물, 밤의 조명, DJ,
 * 루프탑 — 다 다른 장면인데 한 장만 보고 정해야 했다.
 *
 * **가로로 흘려 보여 준다.** 세로로 쌓으면 사진 다섯 장이 화면 두 개를
 * 잡아먹어서 그 아래 라인업·가격까지 내려가는 사람이 줄어든다.
 *
 * 누르면 크게 본다. 폰에서 사진을 작게만 보여 주면 결국 손가락으로
 * 확대하려다 스크롤이 튄다.
 */
export function PhotoStrip({ photos }: { photos: EventPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;

  return (
    <section className="border-b-8 border-soft py-4.5">
      <h4 className="mb-3 px-4 text-base font-extrabold">사진</h4>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className="relative aspect-4/5 w-[168px] flex-none snap-start overflow-hidden rounded-xl bg-soft transition active:opacity-70"
          >
            <Image
              src={p.url}
              alt={p.caption ?? ""}
              fill
              sizes="168px"
              className="object-cover"
            />
            {p.caption ? (
              <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#080a0e]/80 to-transparent px-2.5 pb-2 pt-6 text-left text-[11.5px] font-semibold text-white">
                {p.caption}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {open !== null ? (
        <div
          onClick={() => setOpen(null)}
          /* 셸의 안전영역까지 덮는 자리다. 안 넣으면 닫기 버튼이 상태바에 물린다 */
          className="absolute inset-0 z-30 flex flex-col bg-[#080a0e] pt-[env(safe-area-inset-top)]"
        >
          <div className="flex flex-none justify-end p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[20px] leading-none text-white">
              ×
            </span>
          </div>
          <div className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto">
            {photos.map((p, i) => (
              <div
                key={p.id}
                ref={
                  i === open
                    ? (el) => el?.scrollIntoView({ inline: "start" })
                    : undefined
                }
                className="relative flex w-full flex-none snap-start flex-col items-center justify-center px-3"
              >
                <div className="relative aspect-4/5 w-full overflow-hidden rounded-xl">
                  <Image
                    src={p.url}
                    alt={p.caption ?? ""}
                    fill
                    sizes="430px"
                    className="object-contain"
                  />
                </div>
                {p.caption ? (
                  <p className="mt-3 text-[13.5px] text-white/80">
                    {p.caption}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="flex-none py-4 text-center text-[12.5px] text-white/45">
            {`옆으로 넘겨 보세요 · ${photos.length}장`}
          </p>
        </div>
      ) : null}
    </section>
  );
}
