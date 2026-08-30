"use client";

import Image from "next/image";
import { useState } from "react";

import type { EventPhoto, EventRecap } from "@/types/database";

/**
 * 끝난 파티의 기록.
 *
 * 파티가 끝나면 그 페이지는 팔 게 없어진다. 그렇다고 지우면 **다음 파티를
 * 고민하는 사람이 볼 게 없다** — 처음 오는 사람이 제일 궁금해하는 건
 * "지난번엔 어땠나" 다. 그래서 파는 판을 기록으로 바꾼다.
 *
 * 숫자를 먼저 두고 사진을 뒤에 둔다. 사진은 어느 파티나 비슷해 보이지만
 * **몇 명이 왔는지는 그 파티만의 사실**이다.
 *
 * 이름·연락처·금액은 한 줄도 안 나온다. 집계만 온다(event_recap).
 */
export function Recap({
  recap,
  photos,
}: {
  recap: EventRecap | null;
  photos: EventPhoto[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!recap && photos.length === 0) return null;

  const stats = recap
    ? [
        // 입장 체크를 안 한 파티는 온 사람 수를 모른다. 예매 수를
        // 다녀간 수인 척 적지 않는다 — 이름을 바꿔 단다
        recap.came
          ? { k: "다녀갔어요", v: `${recap.came}명` }
          : { k: "예매", v: `${recap.booked}명` },
        { k: "여 · 남", v: `${recap.booked_f} · ${recap.booked_m}` },
        { k: "혼자 온 사람", v: `${recap.solo}명` },
        ...(recap.tables ? [{ k: "테이블", v: `${recap.tables}팀` }] : []),
      ]
    : [];

  return (
    <section className="border-b-8 border-soft py-5">
      <div className="mb-4 px-4">
        <span className="rounded-md bg-ink px-2 py-1 text-[11.5px] font-bold text-white">
          기록
        </span>
        <h4 className="mt-2.5 text-[19px] font-extrabold">이 파티는 끝났어요</h4>
        <p className="mt-1 text-[13.5px] leading-relaxed text-sub">
          그날 어땠는지 남겨 둡니다. 다음 파티는 홈에서 볼 수 있어요.
        </p>
      </div>

      {stats.length ? (
        <div className="mb-4 grid grid-cols-2 gap-2.5 px-4">
          {stats.map((s) => (
            <div key={s.k} className="rounded-xl bg-soft px-3.5 py-3">
              <small className="text-[12.5px] text-sub">{s.k}</small>
              <b className="mt-0.5 block text-[19px] font-extrabold">{s.v}</b>
            </div>
          ))}
        </div>
      ) : null}

      {/*
        **가로 3:2 두 칸으로 깐다.** 파티 전 사진은 4:5 세로 띠로 흘려
        보여 주는데, 기록은 루프탑 전경처럼 넓은 그림이 많아서 세로로
        자르면 무엇을 찍었는지가 사라진다.
      */}
      {photos.length ? (
        <div className="grid grid-cols-2 gap-1.5 px-4">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(i)}
              className="relative aspect-3/2 overflow-hidden rounded-lg bg-soft transition active:opacity-70"
            >
              <Image
                src={p.url}
                alt={p.caption ?? ""}
                fill
                sizes="(max-width: 430px) 50vw, 215px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {open !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-3"
          onClick={() => setOpen(null)}
        >
          <div className="relative aspect-3/2 w-full">
            <Image
              src={photos[open].url}
              alt=""
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 text-3xl text-white"
            aria-label="닫기"
          >
            ×
          </button>
          {/* 좌우로 넘긴다. 한 장 보고 닫았다 다시 여는 건 아무도 안 한다 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((open + photos.length - 1) % photos.length);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 px-4 py-6 text-3xl text-white/70"
            aria-label="이전"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((open + 1) % photos.length);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-6 text-3xl text-white/70"
            aria-label="다음"
          >
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}
