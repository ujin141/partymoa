"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEvent } from "@/app/(crew)/crew/events/new/actions";
import { updateEvent } from "@/app/(crew)/crew/events/[id]/edit/actions";
import { toLocalInput } from "@/lib/format";
import { priceFor } from "@/lib/rules";
import type {
  EventPhoto,
  EventRow,
  EventTable,
  Lineup,
  TicketTier,
} from "@/types/database";

export interface EventFormInitial {
  event: EventRow;
  tiers: TicketTier[];
  lineups: Lineup[];
  tables: EventTable[];
  photos: EventPhoto[];
}

const CATEGORIES = ["풀파티", "솔로파티", "루프탑", "클럽", "라운지", "야외"];
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

type Crowd = "korean" | "mixed" | "global";

export function EventForm({
  initial,
  crewId,
  crewName,
}: {
  initial?: EventFormInitial;
  /** 새로 만들 때 어느 크루의 파티인지 */
  crewId?: string;
  crewName?: string;
}) {
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
  /**
   * 둘러보기 필터에만 쓰는 값들. **전부 비워 둘 수 있다.**
   * 안 적었다고 목록에서 사라지면 그건 호스트에게 벌을 주는 것이다.
   */
  const [coupleFriendly, setCoupleFriendly] = useState(
    ev?.couple_friendly ?? false,
  );
  const [ageMin, setAgeMin] = useState(
    ev?.age_min == null ? "" : String(ev.age_min),
  );
  const [ageMax, setAgeMax] = useState(
    ev?.age_max == null ? "" : String(ev.age_max),
  );
  const [crowd, setCrowd] = useState<Crowd | "">(ev?.crowd ?? "");
  const [genres, setGenres] = useState<string[]>(ev?.genres ?? []);
  const [categories, setCategories] = useState<string[]>(ev?.categories ?? []);
  const [listPrice, setListPrice] = useState(String(ev?.list_price ?? 59000));
  const [bankAccount, setBankAccount] = useState(ev?.bank_account ?? "");

  const [tiers, setTiers] = useState<
    {
      id?: string;
      name: string;
      note: string;
      price: string;
      malePrice: string;
      capacity: string;
      closed: boolean;
    }[]
  >(
    initial?.tiers.length
      ? initial.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          note: t.note ?? "",
          price: String(t.price),
          malePrice: t.male_price == null ? "" : String(t.male_price),
          capacity: String(t.capacity),
          closed: Boolean(t.closed_at),
        }))
      : [
          {
            name: "1차 얼리버드",
            note: "선착순",
            price: "39000",
            malePrice: "",
            capacity: "40",
            closed: false,
          },
        ],
  );
  /**
   * 테이블(메뉴판). 차수와 다른 물건이다 — **잡으면 입장비가 없다.**
   * 비워 두면 파티 화면에 그 칸이 아예 안 뜬다.
   */
  const [tables, setTables] = useState<
    {
      id?: string;
      name: string;
      price: string;
      cardPrice: string;
      seats: string;
      note: string;
    }[]
  >(
    initial?.tables.map((t) => ({
      id: t.id,
      name: t.name,
      price: String(t.price),
      cardPrice: t.card_price == null ? "" : String(t.card_price),
      seats: String(t.seats),
      note: t.note ?? "",
    })) ?? [],
  );
  const [tablesNote, setTablesNote] = useState(ev?.tables_note ?? "");
  /** 초대 코드를 넣었을 때의 금액. 비우면 할인 없음 */
  const [guestPrice, setGuestPrice] = useState(
    ev?.guest_price == null ? "" : String(ev.guest_price),
  );

  /** 상세에서만 보는 여러 장. 커버(대표 한 장)와 다른 것이다 */
  const [photos, setPhotos] = useState<
    { id?: string; url: string; caption: string }[]
  >(
    initial?.photos.map((x) => ({
      id: x.id,
      url: x.url,
      caption: x.caption ?? "",
    })) ?? [],
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
        crewId,
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
        coupleFriendly,
        ageMin: ageMin.trim() === "" ? null : Number(ageMin) || null,
        ageMax: ageMax.trim() === "" ? null : Number(ageMax) || null,
        crowd: crowd === "" ? null : crowd,
        genres,
        categories,
        listPrice: Number(listPrice) || 0,
        bankAccount,
        tiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          note: t.note,
          price: Number(t.price) || 0,
          malePrice: t.malePrice.trim() === "" ? null : Number(t.malePrice) || 0,
          capacity: Number(t.capacity) || 0,
          closed: t.closed,
        })),
        lineups,
        tables: tables.map((t, i) => ({
          id: t.id,
          name: t.name.trim(),
          price: Number(t.price) || 0,
          cardPrice: t.cardPrice.trim() === "" ? null : Number(t.cardPrice) || 0,
          seats: Number(t.seats) || 0,
          note: t.note.trim() || null,
          sortOrder: i,
        })),
        tablesNote,
        guestPrice: guestPrice.trim() === "" ? null : Number(guestPrice) || 0,
        photos: photos
          .filter((x) => x.url.trim())
          .map((x, i) => ({
            url: x.url.trim(),
            caption: x.caption.trim() || null,
            sortOrder: i,
          })),
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
          : `${crewName ? crewName + " 의 파티로 " : ""}등록하면 작성 중 상태로 저장돼요. 현황에서 예매 중으로 바꿔야 게스트에게 보입니다.`}
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

      <Field label="커플 환영">
        <div className="grid grid-cols-2 gap-2.5">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setCoupleFriendly(v)}
              className={`rounded-xl border-[1.5px] py-3.5 text-[15px] font-semibold ${
                coupleFriendly === v
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-white"
              }`}
            >
              {v ? "환영" : "표시 안 함"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-sub">
          1인 참여 환영과 반대말이 아니에요. 둘 다 켜도 됩니다.
        </p>
      </Field>

      <Field label="연령대 (선택)">
        <div className="flex items-center gap-2">
          <input
            className={`${input} flex-1`}
            inputMode="numeric"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, ""))}
            placeholder="23"
          />
          <span className="text-[15px] text-sub">~</span>
          <input
            className={`${input} flex-1`}
            inputMode="numeric"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, ""))}
            placeholder="32"
          />
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-sub">
          비워 두면 연령대 필터에서 안 걸러집니다. 입장을 막는 값이
          아니라 손님이 찾을 때 쓰는 값이에요.
        </p>
      </Field>

      <Field label="한국인/외국인 (선택)">
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["", "미정"],
              ["korean", "한국인 위주"],
              ["mixed", "반반"],
              ["global", "외국인 많음"],
            ] as [Crowd | "", string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setCrowd(v)}
              className={`rounded-xl border-[1.5px] py-3 text-[12.5px] font-semibold ${
                crowd === v
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-white text-sub"
              }`}
            >
              {label}
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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="mb-1 block text-[12px] text-sub">여성가</span>
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
              <span className="mb-1 block text-[12px] text-sub">남성가</span>
              <input
                className={input}
                inputMode="numeric"
                value={t.malePrice}
                placeholder={String(
                  priceFor(
                    Number(t.price) || 0,
                    "M",
                    Number(maleMultiplier) || 1,
                  ),
                )}
                onChange={(e) =>
                  setTiers(
                    tiers.map((x, j) =>
                      j === i
                        ? { ...x, malePrice: e.target.value.replace(/\D/g, "") }
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

          {/* **자리 수와 "판다/안 판다" 는 다른 이야기다.** 정원으로만
              판단하면, 끝난 차수에서 한 건이 취소되는 순간 그 차수가
              다시 열리고 가격이 옛 가격으로 돌아간다 */}
          <label className="mt-2.5 flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={t.closed}
              onChange={(e) =>
                setTiers(
                  tiers.map((x, j) =>
                    j === i ? { ...x, closed: e.target.checked } : x,
                  ),
                )
              }
              className="h-4 w-4 accent-brand"
            />
            <span className={t.closed ? "font-bold text-hot" : "text-sub"}>
              마감 — 자리가 남아도 안 팝니다
            </span>
          </label>
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
              malePrice: "",
              capacity: "",
              closed: false,
            },
          ])
        }
        className="mb-6 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold"
      >
        차수 추가
      </button>

      <h4 className="mb-1 text-base font-extrabold">게스트 가격</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        DJ·크루 초대 코드를 넣은 손님에게 적용할 금액. 비워 두면 코드는
        <b className="text-ink"> 집계에만 </b>쓰이고 금액은 안 바뀝니다.
      </p>
      <input
        className={`${input} mb-6`}
        inputMode="numeric"
        value={guestPrice}
        placeholder="30000"
        onChange={(e) => setGuestPrice(e.target.value.replace(/\D/g, ""))}
      />

      {/* ── 테이블 (메뉴판) ── */}
      <h4 className="mb-1 text-base font-extrabold">테이블</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        VIP · VVIP 처럼 자리를 통째로 파는 것. <b className="text-ink">테이블을
        잡은 인원은 입장비를 안 냅니다.</b> 안 팔면 비워 두세요 — 파티
        화면에 그 칸이 아예 안 뜹니다.
      </p>
      {tables.map((t, i) => (
        <div key={i} className="mb-2.5 rounded-xl border border-line p-3">
          <div className="mb-2 flex gap-2">
            <input
              className={input}
              value={t.name}
              onChange={(e) =>
                setTables(
                  tables.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              placeholder="VIP"
            />
            <button
              type="button"
              onClick={() => setTables(tables.filter((_, j) => j !== i))}
              className="flex-none rounded-xl border border-line px-3 text-[13px] text-sub"
            >
              삭제
            </button>
          </div>
          <div className="mb-2 grid grid-cols-3 gap-2">
            <div>
              <span className="mb-1 block text-[12px] text-sub">인원</span>
              <input
                className={input}
                inputMode="numeric"
                value={t.seats}
                onChange={(e) =>
                  setTables(
                    tables.map((x, j) =>
                      j === i
                        ? { ...x, seats: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div>
              <span className="mb-1 block text-[12px] text-sub">계좌이체</span>
              <input
                className={input}
                inputMode="numeric"
                value={t.price}
                onChange={(e) =>
                  setTables(
                    tables.map((x, j) =>
                      j === i
                        ? { ...x, price: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div>
              <span className="mb-1 block text-[12px] text-sub">카드</span>
              <input
                className={input}
                inputMode="numeric"
                value={t.cardPrice}
                placeholder="없으면 비움"
                onChange={(e) =>
                  setTables(
                    tables.map((x, j) =>
                      j === i
                        ? { ...x, cardPrice: e.target.value.replace(/\D/g, "") }
                        : x,
                    ),
                  )
                }
              />
            </div>
          </div>
          <input
            className={input}
            value={t.note}
            onChange={(e) =>
              setTables(
                tables.map((x, j) =>
                  j === i ? { ...x, note: e.target.value } : x,
                ),
              )
            }
            placeholder="샴페인 1병 · 음료수 3 · 생수 4"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setTables([
            ...tables,
            { name: "", price: "", cardPrice: "", seats: "4", note: "" },
          ])
        }
        className="mb-3 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold"
      >
        테이블 추가
      </button>

      {tables.length > 0 ? (
        <>
          <span className="mb-1.5 block text-[13.5px] font-bold">
            공통 안내
          </span>
          <textarea
            className={`${input} mb-6 min-h-[110px] resize-y`}
            value={tablesNote}
            onChange={(e) => setTablesNote(e.target.value)}
            placeholder={
              [
                "테이블 인원 전원 입장료 면제 · 방수 손목밴드 · 락커 포함",
                "샴페인은 DEEP LUMINOUS 750ml",
                "표시 가격은 계좌이체 기준",
              ].join("\n")
            }
          />
        </>
      ) : (
        <div className="mb-6" />
      )}

      {/* ── 사진 ── */}
      <h4 className="mb-1 text-base font-extrabold">사진</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        상세 화면에서 옆으로 넘겨 보는 여러 장. 커버 한 장으로는 어떤
        파티인지 안 전해집니다. 세로(4:5) 사진이 제일 잘 맞아요.
      </p>
      {photos.map((x, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <input
            className={input}
            value={x.url}
            onChange={(e) =>
              setPhotos(
                photos.map((y, j) =>
                  j === i ? { ...y, url: e.target.value } : y,
                ),
              )
            }
            placeholder="사진 주소 https://…"
          />
          <input
            className={`${input} w-32 flex-none`}
            value={x.caption}
            onChange={(e) =>
              setPhotos(
                photos.map((y, j) =>
                  j === i ? { ...y, caption: e.target.value } : y,
                ),
              )
            }
            placeholder="설명"
          />
          <button
            type="button"
            onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
            className="flex-none rounded-xl border border-line px-3 text-[13px] text-sub"
          >
            삭제
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setPhotos([...photos, { url: "", caption: "" }])}
        className="mb-6 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold"
      >
        사진 추가
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
