import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/FavoriteButton";
import { Badge, Tag } from "@/components/ui/primitives";
import { shortDate } from "@/lib/format";
import { discountRate, isClosingSoon, priceFor, soldRate } from "@/lib/rules";
import type { PartyCardData } from "@/lib/queries";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="600" height="360" fill="#F5F6F8"/></svg>`,
  );

function priceLine(d: PartyCardData) {
  if (!d.tier) return null;
  // 카드에는 **여성 기준가**를 보여 준다. 성별 선택은 예매 시트에서 한다
  const price = priceFor(d.tier.price, "F", d.event.male_price_multiplier);
  return { price, off: discountRate(d.event.list_price, price) };
}

/** 잔여 문구. 30% 이하로 남으면 핫 컬러가 된다 (사양서 4-3) */
function LeftLine({ d }: { d: PartyCardData }) {
  const left = Math.max(0, d.stats.capacity - d.stats.booked);
  const pct = soldRate(d.stats.booked, d.stats.capacity);
  const hot = isClosingSoon(d.stats.booked, d.stats.capacity);
  return (
    <p
      className={`mt-1.5 text-[12.5px] ${
        hot ? "font-bold text-hot" : "text-sub"
      }`}
    >
      {left > 0 ? `${left}자리 남았어요 · ${pct}% 예매` : "매진됐어요"}
    </p>
  );
}

export function PartyCard({ d }: { d: PartyCardData }) {
  const p = priceLine(d);
  const hot = isClosingSoon(d.stats.booked, d.stats.capacity);
  return (
    <Link
      href={`/party/${d.event.slug}`}
      className="block px-4 pb-5 transition active:opacity-70"
    >
      <div className="relative aspect-5/3 overflow-hidden rounded-card bg-soft">
        <Image
          src={d.event.cover_url || FALLBACK}
          alt=""
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover"
        />
        {hot ? (
          <Badge tone="hot">마감임박</Badge>
        ) : d.event.solo_friendly ? (
          <Badge>1인 환영</Badge>
        ) : null}
        <FavoriteButton eventId={d.event.id} on={d.favorited} />
      </div>
      <h3 className="clamp-2 mt-3 text-[16.5px] font-bold">{d.event.title}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-sub">
        {shortDate(d.event.starts_at)} · {d.event.venue_name} · {d.event.area}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {d.event.solo_friendly ? <Tag tone="solo">1인 참여 환영</Tag> : null}
        {d.event.genres.slice(0, 1).map((g) => (
          <Tag key={g}>{g}</Tag>
        ))}
        <Tag>정원 {d.event.capacity}명</Tag>
      </div>
      {p ? (
        <div className="mt-2 flex items-baseline gap-1.5">
          {p.off > 0 ? (
            <span className="text-sm font-extrabold text-hot">{p.off}%</span>
          ) : null}
          <b className="text-lg font-extrabold">
            {p.price.toLocaleString("ko-KR")}원
          </b>
          {p.off > 0 ? (
            <s className="text-[13px] text-[#B0B4BC]">
              {d.event.list_price.toLocaleString("ko-KR")}원
            </s>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-lg font-extrabold text-sub">매진</div>
      )}
      <LeftLine d={d} />
    </Link>
  );
}

/** 홈 상단 가로 스와이프 카드 */
export function HeroCard({ d }: { d: PartyCardData }) {
  return (
    <Link
      href={`/party/${d.event.slug}`}
      className="w-[290px] flex-none snap-start transition active:opacity-70"
    >
      <div className="relative aspect-29/19 overflow-hidden rounded-card bg-soft">
        <Image
          src={d.event.cover_url || FALLBACK}
          alt=""
          fill
          sizes="290px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#080a0e]/85 to-transparent px-3.5 pb-3.5 pt-9 text-white">
          <b className="clamp-2 block text-[17px] font-extrabold">{d.event.title}</b>
          <span className="text-[12.5px] opacity-85">
            {shortDate(d.event.starts_at)} · {d.event.area} ·{" "}
            {soldRate(d.stats.booked, d.stats.capacity)}% 예매
          </span>
        </div>
      </div>
    </Link>
  );
}

/** 마감 임박 — 순위가 붙은 컴팩트 행 */
export function MiniRow({ d, rank }: { d: PartyCardData; rank: number }) {
  const p = priceLine(d);
  return (
    <Link
      href={`/party/${d.event.slug}`}
      className="flex items-center gap-3 px-4 py-3 transition active:bg-soft"
    >
      <span className="w-4 flex-none text-[17px] font-extrabold text-brand">
        {rank}
      </span>
      <div className="relative h-[78px] w-[78px] flex-none overflow-hidden rounded-xl bg-soft">
        <Image
          src={d.event.cover_url || FALLBACK}
          alt=""
          fill
          sizes="78px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold">{d.event.title}</h3>
        <p className="mt-1 text-[12.5px] text-sub">
          {shortDate(d.event.starts_at)} · {d.event.area}
        </p>
        <p className="mt-1 text-[12.5px] font-bold text-hot">
          {Math.max(0, d.stats.capacity - d.stats.booked)}자리 남음
        </p>
      </div>
      {p ? (
        <span className="text-[14.5px] font-extrabold">
          {p.price.toLocaleString("ko-KR")}원
        </span>
      ) : null}
    </Link>
  );
}
