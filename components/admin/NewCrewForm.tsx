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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
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
        placeholder="대표 이메일 — 이 주소로 로그인하면 크루 화면이 열려요"
      />
      <input
        className={`${box} mt-2`}
        value={avatarUrl}
        onChange={(e) => setAvatarUrl(e.target.value)}
        placeholder="로고 주소 (/crews/blackout.png 또는 https://…)"
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
        대표가 아직 가입 전이어도 등록됩니다. 그 이메일로 구글 로그인하는
        순간 크루 화면이 열려요.
      </p>

      {done ? (
        <p className="mt-2 rounded-lg bg-[#E7F7EF] px-3 py-2.5 text-[13px] leading-relaxed text-ok">
          {done}
        </p>
      ) : null}

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
              setDone(null);
              const r = await createCrew({
                name,
                slug,
                ownerEmail,
                bio,
                instagram,
                avatarUrl,
              });
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              // 닫지 않는다. 대표가 아직 가입 전이면 뭘 안내해야 하는지
              // 바로 읽고 나가야 한다
              setDone(r.message);
              setName("");
              setSlug("");
              setOwnerEmail("");
              setBio("");
              setInstagram("");
              setAvatarUrl("");
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
