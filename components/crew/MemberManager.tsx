"use client";

import { useState, useTransition } from "react";

import { addMember, removeMember } from "@/app/(crew)/crew/manage/actions";
import { won } from "@/lib/format";
import type { CrewMember } from "@/types/database";

/**
 * 멤버와 초대 코드.
 *
 * 코드는 크루 내부 정산 근거다(3-4). 그래서 **지운 뒤에도 집계는 남는다** —
 * 예매 행에 코드가 문자열로 박혀 있어서, 멤버를 지워도 그 사람이 데려온
 * 손님 수는 그대로 세어진다.
 */
export function MemberManager({
  members,
  stats,
}: {
  members: CrewMember[];
  /** 코드별 초대 인원·매출. 지금 행사 기준 */
  stats: Record<string, { heads: number; revenue: number }>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="px-4 pt-4">
      <h4 className="mb-1 text-base font-extrabold">멤버 · 초대 코드</h4>
      <p className="mb-3 text-[12.5px] leading-relaxed text-sub">
        멤버마다 코드를 하나씩 줍니다. 손님이 예매할 때 그 코드를 넣으면
        누가 데려왔는지 집계돼요.
      </p>

      {members.length === 0 ? (
        <p className="py-4 text-[13px] text-sub">아직 멤버가 없어요.</p>
      ) : (
        members.map((m) => {
          const s = stats[m.invite_code];
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 border-b border-line py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-bold">
                    {m.display_name}
                  </span>
                  <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                    {m.invite_code}
                  </span>
                  {m.role === "owner" ? (
                    <span className="rounded bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
                      대표
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[12.5px] text-sub">
                  {s ? `${s.heads}명 초대 · ${won(s.revenue)}` : "아직 없음"}
                </div>
              </div>
              {m.role === "owner" ? null : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `${m.display_name} 의 코드를 지울까요?\n이미 이 코드로 들어온 예매의 집계는 그대로 남습니다.`,
                      )
                    )
                      return;
                    start(() => void removeMember(m.id));
                  }}
                  className="-m-2 flex-none p-2 text-[12.5px] text-sub"
                >
                  삭제
                </button>
              )}
            </div>
          );
        })
      )}

      <div className="mt-3.5 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 (AROS)"
          className="min-w-0 flex-1 rounded-xl bg-soft p-3 text-[14.5px] outline-none"
        />
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          placeholder="코드"
          maxLength={12}
          className="w-28 flex-none rounded-xl bg-soft p-3 text-[14.5px] uppercase outline-none"
        />
      </div>
      {err ? (
        <p className="mt-2 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      <button
        type="button"
        disabled={busy || !name.trim() || !code.trim()}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await addMember(name, code);
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            setName("");
            setCode("");
          })
        }
        className="mt-2 w-full rounded-xl border border-line py-3 text-[14.5px] font-semibold disabled:opacity-45"
      >
        멤버 추가
      </button>
    </div>
  );
}
