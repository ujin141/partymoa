"use client";

import { useState, useTransition } from "react";

import { createCrew } from "@/app/(admin)/admin/actions";

const box =
  "w-full rounded-xl bg-soft p-3 text-[14.5px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

export function NewCrewForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-brand px-5 py-2.5 text-[14px] font-bold text-white"
      >
        크루 등록
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-line p-4">
      <h3 className="mb-3 text-[15px] font-extrabold">새 크루</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={box}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="크루 이름 (BLACKOUT)"
        />
        <input
          className={box}
          value={slug}
          onChange={(e) =>
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          placeholder="slug (blackout)"
        />
      </div>
      <input
        className={`${box} mt-2`}
        value={ownerEmail}
        type="email"
        onChange={(e) => setOwnerEmail(e.target.value)}
        placeholder="대표 이메일 — 이미 가입한 계정이어야 해요"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          className={box}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="한 줄 소개"
        />
        <input
          className={box}
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="인스타 핸들"
        />
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-sub">
        계정은 여기서 만들지 않습니다. 대표가 먼저{" "}
        <b className="text-ink">/crew/login</b> 에서 로그인해 계정을 만든 뒤,
        그 이메일을 넣으세요.
      </p>

      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-semibold text-sub"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy || !name.trim() || !slug.trim() || !ownerEmail.includes("@")}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await createCrew({
                name,
                slug,
                ownerEmail,
                bio,
                instagram,
              });
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setOpen(false);
              setName("");
              setSlug("");
              setOwnerEmail("");
              setBio("");
              setInstagram("");
            })
          }
          className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-bold text-white disabled:bg-[#C8CBD2]"
        >
          {busy ? "만드는 중…" : "등록"}
        </button>
      </div>
    </div>
  );
}
