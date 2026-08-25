"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { toggleFavorite } from "@/app/(guest)/favorite-actions";

/**
 * 찜 하트. 카드 위에 얹히므로 **부모 Link 의 클릭을 삼켜야 한다** —
 * 안 그러면 하트를 누를 때마다 상세로 넘어간다.
 *
 * 낙관적 업데이트를 쓴다. 왕복을 기다리면 하트가 굼떠 보이고,
 * 이건 실패해도 손해가 없는 동작이다(예매와 다르다).
 */
export function FavoriteButton({
  eventId,
  on,
  variant = "overlay",
}: {
  eventId: string;
  on: boolean;
  /** overlay = 썸네일 위, plain = 정보 줄 안에 */
  variant?: "overlay" | "plain";
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [liked, setLiked] = useOptimistic(on);

  return (
    <button
      type="button"
      aria-label={liked ? "찜 해제" : "찜하기"}
      aria-pressed={liked}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setLiked(!liked);
          const r = await toggleFavorite(eventId, !liked);
          if (!r.ok && r.needLogin) router.push("/login?next=/explore");
        });
      }}
      className={
        variant === "overlay"
          ? "absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/35 backdrop-blur-sm transition active:scale-90"
          : "grid h-10 w-10 place-items-center rounded-full border border-line transition active:scale-90"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-[17px] w-[17px] ${
          liked
            ? "fill-hot stroke-hot"
            : variant === "overlay"
              ? "fill-none stroke-white"
              : "fill-none stroke-sub"
        }`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3z" />
      </svg>
    </button>
  );
}
