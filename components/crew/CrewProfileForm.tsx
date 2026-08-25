"use client";

import { useState, useTransition } from "react";

import { updateCrew } from "@/app/(crew)/crew/manage/actions";
import type { Crew } from "@/types/database";

const box =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

export function CrewProfileForm({ crew }: { crew: Crew }) {
  const [name, setName] = useState(crew.name);
  const [bio, setBio] = useState(crew.bio ?? "");
  const [instagram, setInstagram] = useState(crew.instagram ?? "");
  const [avatarUrl, setAvatarUrl] = useState(crew.avatar_url ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="px-4 pt-4">
      <h4 className="mb-3 text-base font-extrabold">크루 정보</h4>

      <label className="mb-1.5 block text-[13.5px] font-bold">이름</label>
      <input
        className={`${box} mb-3`}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="mb-1.5 block text-[13.5px] font-bold">소개</label>
      <textarea
        className={`${box} mb-3 h-20 resize-none`}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="서울 기반 DJ 크루"
      />

      <label className="mb-1.5 block text-[13.5px] font-bold">인스타그램</label>
      <input
        className={`${box} mb-3`}
        value={instagram}
        onChange={(e) => setInstagram(e.target.value)}
        placeholder="blackout_crew"
      />

      <label className="mb-1.5 block text-[13.5px] font-bold">
        프로필 이미지 주소
      </label>
      <input
        className={box}
        value={avatarUrl}
        onChange={(e) => setAvatarUrl(e.target.value)}
        placeholder="https://…"
      />
      <p className="mt-1.5 text-[12.5px] text-sub">
        정사각형 이미지가 잘 맞아요. 홈의 크루 줄에 동그랗게 들어갑니다.
      </p>

      {err ? (
        <p className="mt-2.5 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      {msg ? (
        <p className="mt-2.5 text-[13px] font-semibold text-ok">{msg}</p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setErr(null);
            setMsg(null);
            const r = await updateCrew({ name, bio, instagram, avatarUrl });
            if (r.ok) setMsg("저장했어요");
            else setErr(r.message);
          })
        }
        className="mt-3.5 w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "저장 중…" : "저장"}
      </button>
    </div>
  );
}
