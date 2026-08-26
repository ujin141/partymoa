"use client";

import { useState, useTransition } from "react";

import { applyForCrew } from "@/app/(guest)/my/crew-apply/actions";

const box =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13.5px] font-bold">
        {label}
        {required ? <span className="ml-1 text-hot">*</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-sub">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * 크루 신청 폼.
 *
 * **물어보는 것을 줄였다.** 안 쓸 값을 받으면 신청이 길어지고, 길면 안
 * 낸다. 여기 있는 것은 전부 승인 판단이나 연락에 실제로 쓰는 값이다.
 *
 * 주소(slug)는 크루 이름에서 자동으로 만들어 두되 고칠 수 있게 둔다 —
 * 한글 이름이면 자동 생성이 비어서 결국 직접 적어야 한다.
 */
export function CrewApplyForm({ defaultEmail }: { defaultEmail: string }) {
  const [f, setF] = useState({
    crewName: "",
    slug: "",
    instagram: "",
    bio: "",
    contactName: "",
    contactPhone: "",
    email: defaultEmail,
    venue: "",
    scale: "",
    history: "",
    note: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();

  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  const ready =
    f.crewName.trim().length >= 2 &&
    /^[a-z0-9-]{2,32}$/.test(f.slug.trim()) &&
    f.contactName.trim().length > 0 &&
    f.contactPhone.replace(/[^0-9]/g, "").length >= 10 &&
    f.email.includes("@");

  if (done) {
    return (
      <div className="rounded-xl bg-[#E7F7EF] px-4 py-5 text-[14px] leading-relaxed text-ok">
        <b className="block text-[15.5px]">신청 넣었어요.</b>
        확인하고 <b>{f.email}</b> 로 알려 드릴게요. 보통 하루 안에 답합니다.
        <br />
        승인되면 이 화면에서 바로 크루 관리로 들어갈 수 있어요.
      </div>
    );
  }

  return (
    <>
      <Field label="크루 이름" required>
        <input
          className={box}
          value={f.crewName}
          onChange={(e) => {
            set("crewName")(e.target.value);
            if (!slugTouched) {
              set("slug")(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .slice(0, 32),
              );
            }
          }}
          placeholder="BLACKOUT"
        />
      </Field>

      <Field
        label="주소"
        required
        hint={`partymoa.com/explore?crew=${f.slug || "이름"} 으로 열립니다. 영문 소문자·숫자·하이픈.`}
      >
        <input
          className={box}
          value={f.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug")(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
          }}
          placeholder="blackout"
        />
      </Field>

      <Field label="인스타그램" hint="여기서 크루를 확인합니다. 없으면 비워 두세요.">
        <input
          className={box}
          value={f.instagram}
          onChange={(e) => set("instagram")(e.target.value)}
          placeholder="@blackoutcrew_official"
        />
      </Field>

      <Field label="한 줄 소개">
        <input
          className={box}
          value={f.bio}
          onChange={(e) => set("bio")(e.target.value)}
          placeholder="서울 기반 DJ 크루"
        />
      </Field>

      <div className="my-6 border-t border-line pt-6">
        <h3 className="mb-4 text-[15px] font-extrabold">연락처</h3>

        <Field label="담당자 이름" required>
          <input
            className={box}
            value={f.contactName}
            onChange={(e) => set("contactName")(e.target.value)}
            placeholder="송우진"
          />
        </Field>

        <Field label="연락처" required hint="당일 사고가 나면 이 번호로 겁니다.">
          <input
            className={box}
            inputMode="tel"
            value={f.contactPhone}
            onChange={(e) => set("contactPhone")(e.target.value)}
            placeholder="010-0000-0000"
          />
        </Field>

        <Field
          label="이메일"
          required
          hint="이 주소로 로그인하면 크루 화면이 열립니다. 승인 결과도 여기로 갑니다."
        >
          <input
            className={box}
            type="email"
            value={f.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="crew@example.com"
          />
        </Field>
      </div>

      <div className="my-6 border-t border-line pt-6">
        <h3 className="mb-1 text-[15px] font-extrabold">파티</h3>
        <p className="mb-4 text-[12.5px] leading-relaxed text-sub">
          없으면 비워 두셔도 됩니다. 적어 주시면 승인이 빨라져요.
        </p>

        <Field label="주로 여는 장소">
          <input
            className={box}
            value={f.venue}
            onChange={(e) => set("venue")(e.target.value)}
            placeholder="강남 · 홍대 루프탑"
          />
        </Field>

        <Field label="보통 규모">
          <input
            className={box}
            value={f.scale}
            onChange={(e) => set("scale")(e.target.value)}
            placeholder="80~100명"
          />
        </Field>

        <Field label="지금까지 연 파티">
          <textarea
            className={`${box} min-h-[90px] resize-y`}
            value={f.history}
            onChange={(e) => set("history")(e.target.value)}
            placeholder="2026.08 AFTER SUNSET · 어나더 루프탑"
          />
        </Field>

        <Field label="더 할 말">
          <textarea
            className={`${box} min-h-[70px] resize-y`}
            value={f.note}
            onChange={(e) => set("note")(e.target.value)}
          />
        </Field>
      </div>

      {err ? (
        <p className="mb-3 rounded-xl bg-[#FDECEF] px-4 py-3.5 text-[13.5px] leading-relaxed text-hot">
          {err}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await applyForCrew(f);
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            setDone(true);
          })
        }
        className="w-full rounded-xl bg-brand py-4 text-base font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "보내는 중…" : "신청하기"}
      </button>
      <div className="h-6" />
    </>
  );
}
