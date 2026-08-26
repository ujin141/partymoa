"use client";

import { useState, useTransition } from "react";

import { saveProfile } from "@/app/(guest)/my/profile/actions";
import type { Profile } from "@/types/database";

const box =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

/**
 * 프로필 편집.
 *
 * 셋만 받는다. 닉네임은 커뮤니티·후기에 보이는 이름이고, 실명과 연락처는
 * 예매 폼에 미리 채운다 — 매번 다시 적는 게 제일 귀찮고, 오타가 나면
 * 입금자명이 안 맞아 대조가 깨진다.
 */
export function ProfileForm({
  profile,
  email,
}: {
  profile: Profile | null;
  email: string;
}) {
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [realName, setRealName] = useState(profile?.real_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <>
      <div className="mb-5 rounded-xl bg-soft px-4 py-3.5">
        <div className="text-[12.5px] text-sub">로그인 계정</div>
        <div className="mt-0.5 break-all text-[14.5px] font-semibold">
          {email}
        </div>
      </div>

      <label className="mb-1.5 block text-[13.5px] font-bold">닉네임</label>
      <input
        className={box}
        value={nickname}
        maxLength={20}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="커뮤니티와 후기에 보일 이름"
      />
      <p className="mb-4 mt-1.5 text-[12.5px] text-sub">
        비워 두면 글 쓸 때마다 직접 적어야 해요.
      </p>

      <label className="mb-1.5 block text-[13.5px] font-bold">이름</label>
      <input
        className={box}
        value={realName}
        onChange={(e) => setRealName(e.target.value)}
        placeholder="예매할 때 쓸 실명"
      />
      <p className="mb-4 mt-1.5 text-[12.5px] leading-relaxed text-sub">
        입금자명 대조와 현장 확인에 씁니다. 예매 폼에 미리 채워 둘게요.
      </p>

      <label className="mb-1.5 block text-[13.5px] font-bold">연락처</label>
      <input
        className={box}
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-0000-0000"
      />
      <p className="mb-6 mt-1.5 text-[12.5px] text-sub">
        예매한 파티에 변경이 생기면 크루가 이 번호로 연락합니다.
      </p>

      {msg ? (
        <p className="mb-3 rounded-xl bg-[#E7F7EF] px-4 py-3 text-[13.5px] text-ok">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mb-3 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setErr(null);
            setMsg(null);
            const r = await saveProfile({ nickname, realName, phone });
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            setMsg("저장했어요.");
          })
        }
        className="w-full rounded-xl bg-brand py-4 text-base font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy ? "저장 중…" : "저장"}
      </button>
      <div className="h-6" />
    </>
  );
}
