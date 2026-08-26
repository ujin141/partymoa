"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface BannerItem {
  slug: string;
  title: string;
  cover: string;
  line: string;
  badge: string | null;
}

/**
 * 맨 위에서 도는 배너.
 *
 * **손으로 넘기는 것과 저절로 넘어가는 것을 같이 쓴다.** 저절로만
 * 넘어가면 보고 싶은 판을 잡아 둘 수 없고, 손으로만 넘기면 뒤에 뭐가
 * 더 있는지 모르는 사람이 첫 장만 보고 지나간다.
 *
 * 손을 대면 자동 넘김을 멈춘다. 읽는 중에 화면이 움직이는 게 제일
 * 성가시다. 다시 켜지 않는다 — 한 번 잡은 사람은 자기가 넘긴다.
 *
 * 넘김은 CSS 스크롤 스냅에 맡긴다. 위치를 직접 계산해 옮기면 폰마다
 * 폭이 달라서 반 칸씩 어긋난다.
 */
export function HomeBanner({ items }: { items: BannerItem[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (items.length < 2 || held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t = setInterval(() => {
      const el = box.current;
      if (!el) return;
      const w = el.clientWidth;
      const next = Math.round(el.scrollLeft / w) + 1;
      el.scrollTo({
        left: (next >= items.length ? 0 : next) * w,
        behavior: "smooth",
      });
    }, 4200);
    return () => clearInterval(t);
  }, [items.length, held]);

  return (
    <div className="mt-3">
      <div
        ref={box}
        onPointerDown={() => setHeld(true)}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {items.map((b) => (
          <Link
            key={b.slug + b.title}
            href={`/party/${b.slug}`}
            className="relative block h-[188px] w-full flex-none snap-center px-4"
          >
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-soft">
              <Image
                src={b.cover}
                alt=""
                fill
                sizes="430px"
                priority
                className="object-cover"
              />
              {/* 사진 위에 글자를 얹으면 밝은 사진에서 안 읽힌다.
                  아래쪽만 어둡게 깐다 */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0a0c10]/85 to-transparent px-4 pb-3.5 pt-10">
                {b.badge ? (
                  <span className="mb-1.5 inline-block rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                    {b.badge}
                  </span>
                ) : null}
                <b className="block truncate text-[17px] font-extrabold text-white">
                  {b.title}
                </b>
                <span className="mt-0.5 block truncate text-[12.5px] text-white/85">
                  {b.line}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((b, i) => (
            <span
              key={b.slug + b.title}
              className={`h-1.5 rounded-full transition-all ${
                i === at ? "w-4 bg-ink" : "w-1.5 bg-[#D7DAE1]"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
