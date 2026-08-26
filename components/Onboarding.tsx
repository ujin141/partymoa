"use client";

import { useEffect, useRef, useState } from "react";

import { Symbol, Wordmark } from "@/components/Symbol";
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
  const done = useRef(false);

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
      className={`absolute inset-0 z-50 flex flex-col bg-white transition-opacity duration-300 ${
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
              onClick={() => setStep(SLIDES.length)}
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
      ) : (
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
              onClick={finish}
              className="w-full rounded-xl bg-brand py-4 text-base font-bold text-white"
            >
              {areas.length + cats.length > 0 ? "시작하기" : "나중에 고를게요"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
