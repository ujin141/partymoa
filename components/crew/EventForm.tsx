"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEvent } from "@/app/(crew)/crew/events/new/actions";
import { updateEvent } from "@/app/(crew)/crew/events/[id]/edit/actions";
import { priceFor } from "@/lib/rules";
import type { EventRow, Lineup, TicketTier } from "@/types/database";

export interface EventFormInitial {
  event: EventRow;
  tiers: TicketTier[];
  lineups: Lineup[];
}

/** datetime-local 은 로컬 시각 문자열을 받는다. ISO 를 그대로 주면 빈다 */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CATEGORIES = ["풀파티", "루프탑", "클럽", "라운지", "야외"];
const GENRES = ["하우스", "테크노", "디스코", "딥하우스", "힙합", "R&B"];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13.5px] font-bold">{label}</label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-sub">{hint}</p>
      ) : null}
    </div>
  );
}

const input =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

export function EventForm({ initial }: { initial?: EventFormInitial }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const ev = initial?.event;

  const [title, setTitle] = useState(ev?.title ?? "");
  const [subtitle, setSubtitle] = useState(ev?.subtitle ?? "");
  const [description, setDescription] = useState(ev?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(ev?.cover_url ?? "");
  const [venueName, setVenueName] = useState(ev?.venue_name ?? "");
  const [area, setArea] = useState(ev?.area ?? "");
  const [address, setAddress] = useState(ev?.address ?? "");
  const [startsAt, setStartsAt] = useState(
    ev ? toLocalInput(ev.starts_at) : "",
  );
  const [endsAt, setEndsAt] = useState(ev ? toLocalInput(ev.ends_at) : "");
  const [capacity, setCapacity] = useState(String(ev?.capacity ?? 80));
  const [genderBalanced, setGenderBalanced] = useState(
    ev?.gender_balanced ?? true,
  );
  const [maleMultiplier, setMaleMultiplier] = useState(
    String(ev?.male_price_multiplier ?? 1.25),
  );
  const [soloFriendly, setSoloFriendly] = useState(ev?.solo_friendly ?? true);
  const [genres, setGenres] = useState<string[]>(ev?.genres ?? []);
  const [categories, setCategories] = useState<string[]>(ev?.categories ?? []);
  const [listPrice, setListPrice] = useState(String(ev?.list_price ?? 59000));
  const [bankAccount, setBankAccount] = useState(ev?.bank_account ?? "");

  const [tiers, setTiers] = useState<
    { id?: string; name: string; note: string; price: string; capacity: string }[]
  >(
    initial?.tiers.length
      ? initial.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          note: t.note ?? "",
          price: String(t.price),
          capacity: String(t.capacity),
        }))
      : [{ name: "1차 얼리버드", note: "선착순", price: "39000", capacity: "40" }],
  );
  const [lineups, setLineups] = useState(
    initial?.lineups.length
      ? initial.lineups.map((l) => ({
          artist: l.artist_name,
          time: l.starts_at.slice(0, 5),
        }))
      : [{ artist: "", time: "" }],
  );

  const toggle = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function submit() {
    setErr(null);
    start(async () => {
      const payload = {
        title,
        subtitle,
        description,
        coverUrl,
        venueName,
        area,
        address,
        startsAt,
        endsAt,
        capacity: Number(capacity) || 0,
        genderBalanced,
        maleMultiplier: Number(maleMultiplier) || 1,
        soloFriendly,
        genres,
        categories,
        listPrice: Number(listPrice) || 0,
        bankAccount,
        tiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          note: t.note,
          price: Number(t.price) || 0,
          capacity: Number(t.capacity) || 0,
        })),
        lineups,
      };

      if (ev) {
        const r = await updateEvent(ev.id, payload);
        if (!r.ok) {
          setErr(r.message);
          return;
        }
        router.push(`/crew?e=${ev.id}`);
        return;
      }

      const r = await createEvent(payload);
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      router.push(`/crew?e=${r.eventId}`);
    });
  }

  return (
    <div className="px-4 py-5">
      <h1 className="text-[22px] font-extrabold">
        {ev ? "파티 수정" : "파티 등록"}
      </h1>
      <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-sub">
        {ev
          ? "이미 팔린 차수는 지울 수 없고, 정원은 예매 수보다 줄일 수 없어요."
          : "등록하면 작성 중 상태로 저장돼요. 현황에서 예매 중으로 바꿔야 게스트에게 보입니다."}
      </p>

      <Field label="제목">
        <input
          className={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="AFTER SUNSET 야외 풀파티"
        />
      </Field>
      <Field label="한 줄 설명">
        <input
          className={input}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="해질녘부터 자정까지"
        />
      </Field>
      <Field label="상세 설명">
        <textarea
          className={`${input} h-28 resize-none`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="커버 이미지 주소" hint="정사각이 아니라 가로 5:3 이 맞아요.">
        <input
          className={input}
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="장소">
          <input
            className={input}
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="어나더 라운지"
          />
        </Field>
        <Field label="지역">
          <input
            className={input}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="양재"
          />
        </Field>
      </div>
      <Field label="주소">
        <input
          className={input}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="시작">
          <input
            type="datetime-local"
            className={input}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </Field>
        <Field label="종료">
          <input
            type="datetime-local"
            className={input}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="정원">
          <input
            className={input}
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="정가" hint="할인율 계산 기준">
          <input
            className={input}
            inputMode="numeric"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>

      <Field
        label="성비 조절"
        hint={
          genderBalanced
            ? `남녀 각각 ${Math.floor((Number(capacity) || 0) / 2)}명까지 받아요. 한쪽이 차면 그 성별 예매가 닫힙니다.`
            : "성별과 무관하게 선착순으로 받아요."
        }
      >
        <div className="grid grid-cols-2 gap-2.5">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setGenderBalanced(v)}
              className={`rounded-xl border-[1.5px] py-3.5 text-[15px] font-semibold ${
                genderBalanced === v
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-white"
              }`}
            >
              {v ? "사용" : "사용 안 함"}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="남성가 계수"
        hint={`여성가 × ${maleMultiplier || 1} 로 계산해 천 원 단위로 반올림해요.`}
      >
        <input
          className={input}
          inputMode="decimal"
          value={maleMultiplier}
          onChange={(e) =>
            setMaleMultiplier(e.target.value.replace(/[^0-9.]/g, ""))
          }
        />
      </Field>

      <Field label="1인 참여 환영">
        <div className="grid grid-cols-2 gap-2.5">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setSoloFriendly(v)}
              className={`rounded-xl border-[1.5px] py-3.5 text-[15px] font-semibold ${
                soloFriendly === v
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-white"
              }`}
            >
              {v ? "환영" : "표시 안 함"}
            </button>
          ))}
        </div>
      </Field>

      <Field label="장르">
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggle(genres, g, setGenres)}
              className={`rounded-full border px-3.5 py-2 text-[13.5px] ${
                genres.includes(g)
                  ? "border-ink bg-ink font-semibold text-white"
                  : "border-line text-sub"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </Field>

      <Field label="카테고리">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(categories, c, setCategories)}
              className={`rounded-full border px-3.5 py-2 text-[13.5px] ${
                categories.includes(c)
                  ? "border-ink bg-ink font-semibold text-white"
                  : "border-line text-sub"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      <Field label="입금 계좌">
        <input
          className={input}
          value={bankAccount}
          onChange={(e) => setBankAccount(e.target.value)}
          placeholder="국민 123456-78-901234 (예금주)"
        />
      </Field>

      <h4 className="mb-2 mt-6 text-base font-extrabold">차수</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        가격은 여성 기준가예요. 앞 차수가 소진되면 다음 차수로 자동 전환됩니다.
      </p>
      {tiers.map((t, i) => (
        <div key={i} className="mb-3 rounded-xl border border-line p-3">
          <div className="mb-2 flex gap-2">
            <input
              className={`${input} flex-1`}
              value={t.name}
              onChange={(e) =>
                setTiers(
                  tiers.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              placeholder="1차 얼리버드"
            />
            {tiers.length > 1 ? (
              <button
                type="button"
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                className="-my-2 flex-none px-3 py-2 text-[13px] text-sub"
              >
                삭제
              </button>
            ) : null}
          </div>
          <input
            className={`${input} mb-2`}
            value={t.note}
            onChange={(e) =>
              setTiers(
                tiers.map((x, j) =>
                  j === i ? { ...x, note: e.target.value } : x,
                ),
              )
            }
            placeholder="선착순 40명"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-[12px] text-sub">
                여성가 / 남성{" "}
                {priceFor(
                  Number(t.price) || 0,
                  "M",
                  Number(maleMultiplier) || 1,
                ).toLocaleString("ko-KR")}
                원
              </span>
              <input
                className={input}
                inputMode="numeric"
                value={t.price}
                onChange={(e) =>
                  setTiers(
                    tiers.map((x, j) =>
                      j === i
                        ? { ...x, price: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div>
              <span className="mb-1 block text-[12px] text-sub">수량</span>
              <input
                className={input}
                inputMode="numeric"
                value={t.capacity}
                onChange={(e) =>
                  setTiers(
                    tiers.map((x, j) =>
                      j === i
                        ? { ...x, capacity: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setTiers([
            ...tiers,
            {
              name: `${tiers.length + 1}차 사전예매`,
              note: "",
              price: "",
              capacity: "",
            },
          ])
        }
        className="mb-6 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold"
      >
        차수 추가
      </button>

      <h4 className="mb-3 text-base font-extrabold">라인업</h4>
      {lineups.map((l, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <input
            className={`${input} flex-1`}
            value={l.artist}
            onChange={(e) =>
              setLineups(
                lineups.map((x, j) =>
                  j === i ? { ...x, artist: e.target.value } : x,
                ),
              )
            }
            placeholder="AROS"
          />
          <input
            type="time"
            className={`${input} w-32 flex-none`}
            value={l.time}
            onChange={(e) =>
              setLineups(
                lineups.map((x, j) =>
                  j === i ? { ...x, time: e.target.value } : x,
                ),
              )
            }
          />
          {lineups.length > 1 ? (
            <button
              type="button"
              onClick={() => setLineups(lineups.filter((_, j) => j !== i))}
              className="-my-2 flex-none px-3 py-2 text-[13px] text-sub"
            >
              삭제
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLineups([...lineups, { artist: "", time: "" }])}
        className="mb-6 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold"
      >
        라인업 추가
      </button>

      {err ? (
        <p className="mb-3 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="w-full rounded-xl bg-brand py-4 text-base font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "저장 중…" : ev ? "저장" : "파티 등록"}
      </button>
      <div className="h-6" />
    </div>
  );
}
