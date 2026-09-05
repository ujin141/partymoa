import Image from "next/image";
import Link from "next/link";

import { Tag } from "@/components/ui/primitives";
import { shortDate, timeRange } from "@/lib/format";
import type { PartyCardData } from "@/lib/queries";
import { genderCap, isClosingSoon, priceFor } from "@/lib/rules";

/**
 * 홈에서 파티 하나를 **크게** 보여 주는 카드.
 *
 * 파티가 한둘일 때 2열 격자에 넣으면 오른쪽 반이 빈다. 그 자리에 다른
 * 파티를 세울 수 없으니, 한 장을 넓게 쓰고 **그 파티에 대해 더 말한다** —
 * 언제, 얼마, 몇 자리, 누가 트는지, 뭐가 딸려 오는지. 카드 한 장이
 * 상세 페이지의 첫 화면 노릇을 한다.
 *
 * 규격
 *
 *     커버      5:3, rounded-card. 배너와 같은 비율
 *     숫자 칸   3열, gap 8, bg-soft, rounded-xl. 홈 아래 '지금까지' 와 같은 칸
 *     글자      제목 20 · 부제 13 · 숫자 17 · 라벨 12
 */
export function HomeFeature({
  d,
  djs,
  perks,
}: {
  d: PartyCardData;
  djs: { name: string; time: string | null }[];
  perks: { name: string; qty: number }[];
}) {
  const left = Math.max(0, d.stats.capacity - d.stats.booked);
  const hot = isClosingSoon(d.stats.booked, d.stats.capacity);
  const price = d.tier
    ? priceFor(d.tier.price, "F", d.event.male_price_multiplier)
    : null;
  const cap = genderCap(d.event.capacity);
  const leftF = Math.max(0, cap - d.stats.booked_f);
  const leftM = Math.max(0, cap - d.stats.booked_m);

  // 서울 기준 며칠 남았나. UTC 로 세면 자정 언저리에서 하루가 밀린다
  const days = Math.ceil(
    (+new Date(d.event.starts_at) - Date.now()) / 86400000,
  );
  const dday = days <= 0 ? "오늘" : `D-${days}`;

  return (
    <Link
      href={`/party/${d.event.slug}`}
      className="mx-4 block transition active:opacity-70"
    >
      <div className="relative aspect-5/3 overflow-hidden rounded-card bg-soft">
        {d.event.cover_url ? (
          <Image
            src={d.event.cover_url}
            alt=""
            fill
            sizes="(max-width: 430px) 100vw, 398px"
            priority
            className="object-cover"
          />
        ) : null}
        <span className="absolute left-3 top-3 rounded-md bg-ink/85 px-2 py-1 text-[12px] font-extrabold text-white">
          {dday}
        </span>
        {hot ? (
          <span className="absolute right-3 top-3 rounded-md bg-hot px-2 py-1 text-[12px] font-bold text-white">
            {`${left}자리 남음`}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <h3 className="text-[20px] font-extrabold leading-tight">
          {d.event.title}
        </h3>
        <p className="mt-1 text-[13px] text-sub">
          {shortDate(d.event.starts_at)} {timeRange(d.event.starts_at, d.event.ends_at)}
          {" · "}
          {d.event.venue_name} · {d.event.area}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-soft px-3 py-2.5">
          <small className="block text-[12px] text-sub">입장</small>
          <b className="mt-0.5 block text-[17px] font-extrabold">
            {price != null ? `${price.toLocaleString("ko-KR")}원` : "—"}
          </b>
        </div>
        <div className="rounded-xl bg-soft px-3 py-2.5">
          <small className="block text-[12px] text-sub">남은 자리</small>
          <b
            className={`mt-0.5 block text-[17px] font-extrabold ${hot ? "text-hot" : ""}`}
          >
            {left > 0 ? `${left}` : "매진"}
            {left > 0 ? (
              <span className="text-[12px] font-semibold text-sub">
                {` / ${d.stats.capacity}`}
              </span>
            ) : null}
          </b>
        </div>
        <div className="rounded-xl bg-soft px-3 py-2.5">
          <small className="block text-[12px] text-sub">
            {d.event.gender_balanced ? "남녀 남은 자리" : "정원"}
          </small>
          <b className="mt-0.5 block text-[17px] font-extrabold">
            {d.event.gender_balanced ? (
              <>
                {`여 ${leftF}`}
                <span className="px-1 text-[12px] font-semibold text-sub">·</span>
                {`남 ${leftM}`}
              </>
            ) : (
              `${d.event.capacity}명`
            )}
          </b>
        </div>
      </div>

      {djs.length > 0 ? (
        <div className="mt-3 flex items-baseline gap-2.5">
          <small className="flex-none text-[12px] font-bold text-sub">
            라인업
          </small>
          <span className="truncate text-[13.5px] font-semibold">
            {djs.map((x) => x.name).join(" · ")}
          </span>
        </div>
      ) : null}

      {perks.length > 0 || d.event.solo_friendly ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {perks.map((p) => (
            <Tag key={p.name}>{`${p.name} 포함`}</Tag>
          ))}
          {d.event.solo_friendly ? <Tag tone="solo">1인 참여 환영</Tag> : null}
        </div>
      ) : null}
    </Link>
  );
}
