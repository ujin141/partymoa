"use client";

import { useState, useTransition } from "react";

import { addMember } from "@/app/(crew)/crew/manage/actions";

/**
 * 현황 화면에서 바로 코드를 하나 더 판다.
 *
 * **여기서 필요해지기 때문이다.** 멤버별 초대를 보다가 "이 사람 코드가
 * 없네" 를 알게 되는데, 그러면 관리 화면으로 넘어갔다가 다시 돌아와야
 * 했다. 파티 당일에 DJ 가 옆에서 기다리는 상황이면 그 왕복이 길다.
 *
 * 접어 둔다. 평소에는 목록만 보이고, 필요할 때만 연다.
 */
export function MemberQuickAdd({ crewId }: { crewId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border border-line py-3 text-[14px] font-semibold text-sub"
      >
        + 초대 코드 추가
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-soft p-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 (AROS)"
          className="min-w-0 flex-1 rounded-lg bg-white p-3 text-[14.5px] outline-none"
        />
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          placeholder="코드"
          maxLength={12}
          className="w-24 flex-none rounded-lg bg-white p-3 text-[14.5px] uppercase outline-none"
        />
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-sub">
        영문 대문자와 숫자 2~12자. 손님이 예매할 때 넣으면 게스트 가격이
        붙고, 누가 데려왔는지 여기에 쌓입니다.
      </p>
      {err ? (
        <p className="mt-1.5 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          className="rounded-lg border border-line bg-white py-2.5 text-[14px] font-semibold text-sub"
        >
          닫기
        </button>
        <button
          type="button"
          disabled={busy || !name.trim() || !code.trim()}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await addMember(crewId, name, code);
              if (!r.ok) {
                setErr(r.message);
                return;
              }
              setName("");
              setCode("");
              setOpen(false);
            })
          }
          className="rounded-lg bg-brand py-2.5 text-[14px] font-bold text-white disabled:bg-[#C8CBD2]"
        >
          {busy ? "추가 중…" : "추가"}
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-sub">
        구글 로그인 주소까지 붙이려면{" "}
        <span className="font-semibold text-ink">관리</span> 화면에서 하세요.
      </p>
    </div>
  );
}
