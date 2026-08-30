"use client";

import { useState, useTransition } from "react";

import { saveProfile } from "@/app/(guest)/my/profile/actions";
import { phoneMask, phoneOk } from "@/lib/format";
import type { Profile } from "@/types/database";

const box =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

// 시작 화면과 같은 목록이어야 한다. 여기만 늘리면 고른 값이 필터에 안 걸린다
const AREAS = ["강남", "홍대", "이태원", "성수", "양재", "잠실"];
const CATEGORIES = [
  "풀파티",
  "솔로파티",
  "루프탑",
  "클럽",
  "라운지",
  "야외",
  "테크노",
  "하우스",
  "힙합",
];

function Chips({
  items,
  picked,
  onToggle,
}: {
  items: string[];
  picked: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onToggle(v)}
          className={`rounded-full border px-3.5 py-2 text-[13.5px] ${
            picked.includes(v)
              ? "border-brand bg-brand font-bold text-white"
              : "border-line text-sub"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

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
  const [phone, setPhone] = useState(phoneMask(profile?.phone ?? ""));
  const [areas, setAreas] = useState<string[]>(profile?.areas ?? []);
  const [cats, setCats] = useState<string[]>(profile?.categories ?? []);
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
        onChange={(e) => setPhone(phoneMask(e.target.value))}
        placeholder="010-0000-0000"
      />
      {phone.trim() && !phoneOk(phone) ? (
        <p className="mb-6 mt-1.5 text-[12.5px] text-hot">
          번호를 다시 확인해 주세요. 해외 번호는 +부터 적어 주세요.
        </p>
      ) : (
        <p className="mb-6 mt-1.5 text-[12.5px] text-sub">
          예매한 파티에 변경이 생기면 호스트가 이 번호로 연락합니다. 여기
          적어 두면 예매할 때 다시 안 적어도 돼요.
        </p>
      )}

      <div className="mb-6 border-t border-line pt-6">
        <h3 className="mb-1 text-[15px] font-extrabold">취향</h3>
        <p className="mb-4 text-[12.5px] leading-relaxed text-sub">
          고른 것부터 홈에 먼저 보여 드려요. 아무것도 안 고르면 전체가 나옵니다.
        </p>

        <h4 className="mb-2.5 text-[13.5px] font-bold">지역</h4>
        <Chips
          items={AREAS}
          picked={areas}
          onToggle={(v) =>
            setAreas(
              areas.includes(v) ? areas.filter((x) => x !== v) : [...areas, v],
            )
          }
        />

        <h4 className="mb-2.5 mt-5 text-[13.5px] font-bold">분위기</h4>
        <Chips
          items={CATEGORIES}
          picked={cats}
          onToggle={(v) =>
            setCats(cats.includes(v) ? cats.filter((x) => x !== v) : [...cats, v])
          }
        />
      </div>

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
            const r = await saveProfile({
              nickname,
              realName,
              phone,
              areas,
              categories: cats,
            });
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
