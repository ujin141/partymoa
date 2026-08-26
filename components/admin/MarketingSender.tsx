"use client";

import { useState, useTransition } from "react";

import { sendMarketing } from "@/app/(admin)/admin/(dash)/push/actions";

const input =
  "w-full rounded-xl bg-soft p-3.5 text-[15px] outline-none border-[1.5px] border-transparent focus:border-brand focus:bg-white";

/**
 * 광고 보내기.
 *
 * **되돌릴 수 없다.** 보낸 알림은 회수가 안 되므로, 미리보기를 띄우고
 * 몇 대로 가는지 이름을 대고 묻는다.
 */
export function MarketingSender({
  night,
  devices,
}: {
  night: boolean;
  devices: number;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ready = Boolean(title.trim() && body.trim()) && !night && devices > 0;

  return (
    <div className="mt-6">
      <label className="mb-1.5 block text-[13.5px] font-bold">제목</label>
      <input
        className={input}
        value={title}
        maxLength={40}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="9월 루프탑 파티 열려요"
      />

      <label className="mb-1.5 mt-4 block text-[13.5px] font-bold">내용</label>
      <textarea
        className={`${input} h-24 resize-none`}
        value={body}
        maxLength={120}
        onChange={(e) => setBody(e.target.value)}
        placeholder="얼리버드 30% · 선착순 40명"
      />

      <label className="mb-1.5 mt-4 block text-[13.5px] font-bold">
        누르면 갈 곳 <span className="font-normal text-sub">(선택)</span>
      </label>
      <input
        className={input}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="/party/어쩌고 · 비우면 홈"
      />

      {/* 손님 폰에 실제로 뜨는 모양. (광고) 와 수신거부 안내가 자동으로 붙는다 */}
      <div className="mt-5 rounded-xl border border-line p-3.5">
        <small className="text-[12px] text-sub">이렇게 갑니다</small>
        <div className="mt-2 rounded-lg bg-soft p-3">
          <b className="block text-[14px] font-extrabold">
            (광고) {title || "제목"}
          </b>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-sub">
            {body || "내용"}
            {"\n\n수신거부: 마이 > 알림"}
          </p>
        </div>
      </div>

      {night ? (
        <p className="mt-4 rounded-xl bg-[#FFF4E5] p-3.5 text-[13px] leading-relaxed text-[#B76E00]">
          지금은 밤 9시~아침 8시라 광고를 보낼 수 없어요. 야간 광고는 별도
          동의를 받아야 합니다 (정보통신망법 50조 3항).
        </p>
      ) : null}

      {err ? (
        <p className="mt-3 text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
      {msg ? (
        <p className="mt-3 rounded-xl bg-brand-soft p-3.5 text-[13px] font-semibold text-brand">
          {msg}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={() => {
          if (
            !confirm(
              `${devices}대로 광고를 보냅니다.\n보낸 알림은 되돌릴 수 없어요.\n\n(광고) ${title}`,
            )
          )
            return;
          setErr(null);
          setMsg(null);
          start(async () => {
            const r = await sendMarketing({ title, body, url });
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            setMsg(
              `${r.sent}대로 보냈어요. 대상 ${r.targets}대` +
                (r.dead ? ` · 죽은 구독 ${r.dead}대 정리` : ""),
            );
            setTitle("");
            setBody("");
            setUrl("");
          });
        }}
        className="mt-4 w-full rounded-xl bg-brand py-4 text-base font-bold text-white disabled:bg-[#C8CBD2]"
      >
        {busy
          ? "보내는 중…"
          : devices === 0
            ? "받을 사람이 없어요"
            : `${devices}대로 보내기`}
      </button>
    </div>
  );
}
