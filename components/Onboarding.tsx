"use client";

import { useEffect, useRef, useState } from "react";

import { Symbol, Wordmark } from "@/components/Symbol";
import { enablePush } from "@/lib/enable-push";
import { savePreferences } from "@/app/(guest)/onboarding/actions";

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

const SLIDES = [
  {
    icon: "◐",
    title: "사전 예약으로\n자리를 잡아 둡니다",
    body: "정원과 성비를 서버가 셉니다. 마감된 자리가 다시 팔리는 일은 없어요.",
  },
  {
    icon: "◑",
    title: "혼자 와도\n어색하지 않게",
    body: "1인 참여를 환영하는 파티만 따로 모아 둡니다. 남녀 인원을 맞춰서 받아요.",
  },
  {
    icon: "◒",
    title: "입금하면 확정,\n티켓은 여기에",
    body: "예매번호와 계좌를 바로 띄웁니다. 24시간 안에 입금하지 않으면 자동으로 풀려요.",
  },
];

/**
 * 시작 화면.
 *
 * **딱 한 번만 뜬다.** 로그인한 사람은 프로필에, 아직 아닌 사람은
 * 브라우저에 본 표시를 남긴다. 매번 뜨는 인트로만큼 빨리 미움받는
 * 화면이 없다.
 *
 * 순서는 로고 → 소개 셋 → 취향. 취향을 맨 뒤에 두는 이유는, 무엇을
 * 하는 앱인지 모르는 상태에서 "뭘 좋아하세요" 를 물으면 아무거나
 * 누르고 넘어가기 때문이다.
 *
 * 애니메이션은 CSS 키프레임으로만 만든다. 시작 화면 하나 때문에
 * 라이브러리를 얹으면 첫 화면이 늦게 뜬다 — 그게 더 나쁘다.
 */
export function Onboarding({
  signedIn,
  initialAreas,
  initialCategories,
}: {
  signedIn: boolean;
  initialAreas: string[];
  initialCategories: string[];
}) {
  const [step, setStep] = useState(-1); // -1 = 로고
  const [areas, setAreas] = useState<string[]>(initialAreas);
  const [cats, setCats] = useState<string[]>(initialCategories);
  const [leaving, setLeaving] = useState(false);
  const [push, setPush] = useState<"ask" | "busy" | "on">("ask");
  /** 실패 이유. **뭉쳐 두면 손님이 할 수 있는 게 없다** */
  const [pushErr, setPushErr] = useState<string | null>(null);
  const done = useRef(false);

  /** 취향 다음이 알림이다. 순서를 숫자로만 쓰면 나중에 못 읽는다 */
  const PREF = SLIDES.length;
  const PUSH = SLIDES.length + 1;

  // 로고가 끝나면 첫 장으로. 누르면 바로 건너뛴다
  useEffect(() => {
    if (step !== -1) return;
    const t = setTimeout(() => setStep(0), 1900);
    return () => clearTimeout(t);
  }, [step]);

  function finish() {
    if (done.current) return;
    done.current = true;
    try {
      localStorage.setItem("pm_onboarded", "1");
    } catch {
      // 저장을 막아 둔 브라우저가 있다. 그래도 화면은 닫아 준다
    }

    // **로그인 전이면 쿠키에 담는다.** localStorage 는 서버가 못 읽어서
    // 홈을 그릴 때 취향을 반영할 방법이 없다 — 방금 고르게 해 놓고
    // 아무것도 안 바뀌면 고른 의미가 없다
    if (!signedIn) {
      const v = encodeURIComponent(JSON.stringify({ areas, categories: cats }));
      document.cookie = `pm_prefs=${v};path=/;max-age=31536000;samesite=lax`;
    }
    if (signedIn) void savePreferences({ areas, categories: cats });
    setLeaving(true);
    setTimeout(() => setStep(99), 320);
  }

  if (step === 99) return null;

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div
      /* absolute inset-0 은 셸의 **패딩 박스** 기준이라 셸이 잡아 둔
         안전영역까지 덮는다. 앱에서는 건너뛰기가 상태바에 물린다 */
      className={`absolute inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)] transition-opacity duration-300 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <style>{`
        @keyframes pm-rise { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
        @keyframes pm-pop  { 0% { opacity:0; transform:scale(.72) rotate(-14deg) }
                             60% { opacity:1; transform:scale(1.08) rotate(4deg) }
                             100% { opacity:1; transform:scale(1) rotate(0) } }
        @keyframes pm-ring { 0% { opacity:.55; transform:scale(.6) }
                             100% { opacity:0; transform:scale(2.1) } }
        @keyframes pm-slide { from { opacity:0; transform:translateX(18px) } to { opacity:1; transform:none } }
        .pm-rise  { animation: pm-rise .5s cubic-bezier(.2,.7,.3,1) both }
        .pm-pop   { animation: pm-pop .8s cubic-bezier(.2,.8,.3,1) both }
        .pm-ring  { animation: pm-ring 1.5s cubic-bezier(.2,.7,.3,1) infinite }
        .pm-slide { animation: pm-slide .38s cubic-bezier(.2,.7,.3,1) both }
        @media (prefers-reduced-motion: reduce) {
          .pm-rise,.pm-pop,.pm-ring,.pm-slide { animation: none !important; opacity: 1 }
        }
      `}</style>

      {step === -1 ? (
        <button
          type="button"
          onClick={() => setStep(0)}
          className="flex flex-1 flex-col items-center justify-center gap-5"
          aria-label="건너뛰기"
        >
          <span className="relative grid place-items-center">
            <span className="pm-ring absolute h-20 w-20 rounded-full border-2 border-brand" />
            <span
              className="pm-ring absolute h-20 w-20 rounded-full border-2 border-brand"
              style={{ animationDelay: ".5s" }}
            />
            <span className="pm-pop relative">
              <Symbol size={62} />
            </span>
          </span>
          <span className="pm-rise" style={{ animationDelay: ".55s" }}>
            <Wordmark size={26} />
          </span>
          <span
            className="pm-rise text-[13px] text-sub"
            style={{ animationDelay: ".85s" }}
          >
            서울 파티, 사전 예약
          </span>
        </button>
      ) : step < SLIDES.length ? (
        <>
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={() => setStep(PREF)}
              className="text-[13.5px] font-semibold text-sub"
            >
              건너뛰기
            </button>
          </div>
          <div
            key={step}
            className="pm-slide flex flex-1 flex-col items-center justify-center px-8 text-center"
          >
            <div className="mb-7 text-[56px] leading-none text-brand">
              {SLIDES[step].icon}
            </div>
            <h2 className="whitespace-pre-line text-[24px] font-extrabold leading-[1.35]">
              {SLIDES[step].title}
            </h2>
            <p className="mt-3.5 text-[14.5px] leading-relaxed text-sub">
              {SLIDES[step].body}
            </p>
          </div>
          <div className="flex flex-none items-center gap-2 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-1.5">
              {SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-5 bg-brand" : "w-1.5 bg-line"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="ml-auto rounded-xl bg-brand px-7 py-3.5 text-[15px] font-bold text-white"
            >
              다음
            </button>
          </div>
        </>
      ) : step === PREF ? (
        <>
          <div className="pm-slide flex-1 overflow-y-auto px-6 pt-10">
            <h2 className="text-[24px] font-extrabold leading-snug">
              어떤 파티를
              <br />
              좋아하세요
            </h2>
            <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
              고른 것부터 먼저 보여 드릴게요. 나중에 마이에서 바꿀 수 있어요.
            </p>

            <h3 className="mb-2.5 mt-7 text-[13.5px] font-bold">지역</h3>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle(areas, setAreas, a)}
                  className={`rounded-full border px-3.5 py-2 text-[13.5px] ${
                    areas.includes(a)
                      ? "border-brand bg-brand font-bold text-white"
                      : "border-line text-sub"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <h3 className="mb-2.5 mt-6 text-[13.5px] font-bold">분위기</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(cats, setCats, c)}
                  className={`rounded-full border px-3.5 py-2 text-[13.5px] ${
                    cats.includes(c)
                      ? "border-brand bg-brand font-bold text-white"
                      : "border-line text-sub"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="h-6" />
          </div>

          <div className="flex-none px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setStep(PUSH)}
              className="w-full rounded-xl bg-brand py-4 text-base font-bold text-white"
            >
              {areas.length + cats.length > 0 ? "다음" : "나중에 고를게요"}
            </button>
          </div>
        </>
      ) : (
        /**
         * 알림 켜기.
         *
         * **맨 뒤에 둔다.** 들어오자마자 권한 창을 띄우면 대부분 차단을
         * 누르고, 한 번 차단하면 설정에 들어가야 풀린다 — 사실상 영영
         * 못 보낸다. 무엇을 하는 앱인지 본 뒤에 물어야 켠다.
         *
         * **왜 필요한지부터 적는다.** 입금 마감과 파티 당일은 놓치면
         * 자리가 날아가는 일이다. 그게 광고가 아니라는 것도 같이 적는다.
         */
        <>
          <div className="pm-slide flex-1 overflow-y-auto px-6 pt-12">
            <div className="mb-7 text-[56px] leading-none text-brand">◓</div>
            <h2 className="text-[24px] font-extrabold leading-snug">
              놓치면 자리가
              <br />
              풀립니다
            </h2>
            <p className="mt-3.5 text-[14.5px] leading-relaxed text-sub">
              예매한 건에 대해서만 보내 드려요. 광고는 보내지 않습니다.
            </p>

            <ul className="mt-7 grid gap-4">
              {[
                ["입금 안내", "계좌와 마감 시각을 예매 직후에 한 번"],
                ["자리가 풀리기 전", "입금 마감 세 시간 전에 한 번"],
                ["파티 전날과 당일", "시간·장소·주소·예매번호"],
              ].map(([t, b]) => (
                <li key={t}>
                  <b className="block text-[15px] font-bold">{t}</b>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-sub">
                    {b}
                  </span>
                </li>
              ))}
            </ul>

            {pushErr ? (
              <p className="mt-6 rounded-xl bg-soft p-4 text-[13px] leading-relaxed text-sub">
                {pushErr}
              </p>
            ) : null}
            <div className="h-6" />
          </div>

          <div className="flex-none px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={push === "busy"}
              onClick={async () => {
                setPush("busy");
                const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
                const r = await enablePush(vapid);
                // **켜졌든 아니든 막지 않는다.** 알림을 못 켠다고 앱을
                // 못 쓰게 하면 그게 더 나쁘다
                if (r.ok) {
                  setPush("on");
                  finish();
                  return;
                }
                setPush("ask");
                // 원인마다 할 일이 다르다. 하나로 뭉쳐 두면 "안 됐다" 만
                // 알려 주고 손님은 아무것도 못 한다
                setPushErr(
                  r.reason === "denied"
                    ? "알림이 차단돼 있어요. 설정 > 파티모아 > 알림에서 허용해 주세요."
                    : r.reason === "install"
                      ? "아이폰 사파리에서는 홈 화면에 추가한 뒤에 켤 수 있어요. 앱으로 받으시면 바로 됩니다."
                      : r.reason === "register"
                        ? "알림 서버에 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요. 시뮬레이터에서는 켜지지 않습니다."
                        : r.reason === "unsupported"
                          ? "이 기기에서는 알림을 켤 수 없어요. 예매와 티켓은 그대로 쓸 수 있어요."
                          : r.message ||
                            "알림을 켜지 못했어요. 마이 > 알림 설정에서 다시 켤 수 있어요.",
                );
              }}
              className="w-full rounded-xl bg-brand py-4 text-base font-bold text-white disabled:opacity-60"
            >
              {push === "busy" ? "잠시만요…" : "알림 받기"}
            </button>
            <button
              type="button"
              onClick={finish}
              className="mt-2 w-full py-3 text-center text-[14px] text-sub"
            >
              나중에 할게요
            </button>
          </div>
        </>
      )}
    </div>
  );
}
