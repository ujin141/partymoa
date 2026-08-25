import Link from "next/link";

import { EventPicker } from "@/components/crew/EventPicker";
import { StatusToggle } from "@/components/crew/StatusToggle";
import { Divider, Gauge } from "@/components/ui/primitives";
import { heads, live, money } from "@/lib/crew";
import { crewPage } from "@/lib/crew-page";
import { longDate, won } from "@/lib/format";
import { genderCap, soldRate } from "@/lib/rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 현황" };

export default async function CrewDashboard({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { events, current } = await crewPage(searchParams);

  if (!current) {
    return (
      <div className="flex-1 overflow-y-auto p-6 text-center">
        <p className="py-16 text-sm leading-8 text-sub">
          아직 등록한 파티가 없어요.
          <br />첫 파티를 올려 보세요.
        </p>
        <Link
          href="/crew/events/new"
          className="inline-block rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white"
        >
          파티 등록
        </Link>
      </div>
    );
  }

  const { event, stats, tiers, bookings, members } = current;
  const rows = live(bookings);
  const paid = rows.filter((b) => b.status !== "pending");
  const inside = rows.filter((b) => b.status === "checked_in");
  const solo = rows.filter((b) => b.quantity === 1);
  const gcap = genderCap(event.capacity);
  const pct = soldRate(stats.booked, stats.capacity);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <EventPicker events={events} current={event.id} />

      <div className="flex items-baseline justify-between px-4 pb-3 pt-5">
        <div>
          <h2 className="text-[19px] font-extrabold">{event.title}</h2>
          <p className="mt-1 text-[13px] text-sub">
            {longDate(event.starts_at)} · {event.venue_name}
          </p>
        </div>
      </div>

      <div className="px-4">
        <Gauge pct={pct} tone={pct >= 90 ? "hot" : "brand"} />
        <div className="mt-2.5 flex justify-between text-[13px] text-sub">
          <span>
            예매 <b className="text-ink">{stats.booked}명</b> / {event.capacity}
          </span>
          <span>
            잔여{" "}
            <b className="text-ink">
              {Math.max(0, event.capacity - stats.booked)}자리
            </b>
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 px-4">
        <div className="rounded-xl bg-soft px-3.5 py-3">
          <small className="text-[12.5px] text-sub">입금 완료</small>
          <b className="mt-0.5 block text-[19px] font-extrabold">
            {heads(paid)}명
          </b>
          <div className="mt-0.5 text-[12px] text-sub">
            미입금 {heads(rows) - heads(paid)}명
          </div>
        </div>
        <div className="rounded-xl bg-soft px-3.5 py-3">
          <small className="text-[12.5px] text-sub">확정 매출</small>
          <b className="mt-0.5 block text-[19px] font-extrabold">
            {won(money(paid))}
          </b>
          <div className="mt-0.5 text-[12px] text-sub">
            예정 포함 {won(money(rows))}
          </div>
        </div>
      </div>

      {event.gender_balanced ? (
        <div className="px-4 pt-5">
          <h4 className="mb-3 text-base font-extrabold">성비</h4>
          <div className="mb-3">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-sub">여성</span>
              <b>
                {stats.booked_f} / {gcap}
              </b>
            </div>
            <Gauge pct={(stats.booked_f / gcap) * 100} />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-sub">남성</span>
              <b>
                {stats.booked_m} / {gcap}
              </b>
            </div>
            <Gauge pct={(stats.booked_m / gcap) * 100} />
          </div>
          <p className="mt-3.5 text-[13px] leading-relaxed text-sub">
            {stats.booked_f >= gcap || stats.booked_m >= gcap
              ? "한쪽이 마감되어 해당 성별 예매가 닫혀 있어요."
              : "양쪽 모두 예매 가능한 상태예요."}
          </p>
        </div>
      ) : null}

      <Divider />

      <div className="px-4 pt-4">
        <h4 className="mb-3 text-base font-extrabold">차수별 판매</h4>
        <div className="grid grid-cols-3 gap-2">
          {tiers.map((t) => (
            <div key={t.id} className="rounded-xl bg-soft px-3 py-2.5">
              <small className="text-[12px] text-sub">{t.name}</small>
              <b className="mt-0.5 block text-[17px] font-extrabold">
                {t.sold}
                <span className="text-[13px] font-semibold text-sub">
                  /{t.capacity}
                </span>
              </b>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-soft px-3 py-2.5">
            <small className="text-[12px] text-sub">1인 참여</small>
            <b className="mt-0.5 block text-[17px] font-extrabold">
              {solo.length}명
            </b>
          </div>
          <div className="rounded-xl bg-soft px-3 py-2.5">
            <small className="text-[12px] text-sub">입장 완료</small>
            <b className="mt-0.5 block text-[17px] font-extrabold">
              {heads(inside)}명
            </b>
          </div>
          <div className="rounded-xl bg-soft px-3 py-2.5">
            <small className="text-[12px] text-sub">예매 건수</small>
            <b className="mt-0.5 block text-[17px] font-extrabold">
              {rows.length}건
            </b>
          </div>
        </div>
      </div>

      <Divider />

      <div className="px-4 pt-4">
        <h4 className="mb-1 text-base font-extrabold">멤버별 초대</h4>
        {members.length === 0 ? (
          <p className="py-4 text-[13px] text-sub">
            초대 코드를 발급한 멤버가 없어요.
          </p>
        ) : (
          members.map((m) => {
            const mine = rows.filter((b) => b.invite_code === m.invite_code);
            return (
              <div
                key={m.id}
                className="flex items-center border-b border-line py-3 last:border-b-0"
              >
                <div>
                  <div className="text-[15px] font-bold">{m.display_name}</div>
                  <div className="mt-0.5 text-[12.5px] text-sub">
                    {m.invite_code} · {heads(mine)}명 초대
                  </div>
                </div>
                <div className="ml-auto text-[15px] font-extrabold">
                  {won(money(mine))}
                </div>
              </div>
            );
          })
        )}
        <p className="mt-3 text-[12.5px] leading-relaxed text-sub">
          초대 코드를 입력하지 않은 예매는 집계에서 빠집니다.
        </p>
      </div>

      <Divider />

      <div className="px-4 py-4">
        <h4 className="mb-3 text-base font-extrabold">예매 상태</h4>
        <StatusToggle eventId={event.id} status={event.status} />
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Link
            href="/crew/events/new"
            className="rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold"
          >
            새 파티 등록
          </Link>
          <Link
            href="/crew/manage"
            className="rounded-xl border border-line py-3.5 text-center text-[15px] font-semibold"
          >
            크루 관리
          </Link>
        </div>
      </div>
      <div className="h-4" />
    </div>
  );
}
