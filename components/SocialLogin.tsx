"use client";

import { useEffect, useState } from "react";

import { isNativeIOS } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "apple" | "google";

const LABEL: Record<Provider, string> = {
  kakao: "카카오로 계속하기",
  apple: "Apple로 계속하기",
  google: "Google로 계속하기",
};

const STYLE: Record<Provider, string> = {
  kakao: "bg-[#FEE500] text-[#191600]",
  apple: "bg-black text-white",
  google: "bg-white text-[#1F1F1F] border border-line",
};

function Icon({ p }: { p: Provider }) {
  if (p === "kakao") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3C6.98 3 2.9 6.2 2.9 10.16c0 2.53 1.68 4.75 4.2 6.01-.18.66-.67 2.4-.77 2.78-.12.47.17.46.36.34.15-.1 2.4-1.63 3.37-2.29.63.09 1.28.14 1.94.14 5.02 0 9.1-3.2 9.1-7.16C21.1 6.2 17.02 3 12 3z"
        />
      </svg>
    );
  }
  if (p === "apple") {
    return (
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.36 12.72c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.79-3.33.79-.69 0-1.75-.77-2.87-.75-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71s1.7.71 2.87.69c1.18-.02 1.93-1.08 2.65-2.14.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.89-2.31-3.52zM14.2 6.3c.6-.74 1.01-1.76.9-2.79-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.22z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.14-3.14-.4-4.63H24v8.76h11.83c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.55-9.47 6.55-16.29z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A22 22 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.94 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"
      />
    </svg>
  );
}

/**
 * 소셜 로그인.
 *
 * **익명 세션이 있으면 새로 로그인하지 않고 계정을 잇는다(linkIdentity).**
 * 그냥 signInWithOAuth 를 부르면 Supabase 가 **새 user 를 만들어** 버리고,
 * 익명으로 잡아 둔 예매는 옛 user_id 에 남아 내 티켓에서 사라진다.
 * 로그인했더니 티켓이 없어지는 게 제일 나쁜 경우다.
 *
 * 프로젝트에서 Manual linking 을 안 켰으면 linkIdentity 가 실패한다.
 * 그때는 일반 로그인으로 넘어가되, 티켓은 예매번호로 다시 찾을 수 있다.
 */
/**
 * **켜 둔 제공자만 보여 준다.**
 *
 * 카카오는 Supabase 프로젝트에서 아직 안 켰다. 버튼만 있고 누르면
 * "provider is not enabled" 가 뜨는 게 제일 나쁘다 — 손님은 앱이 고장 난
 * 줄 안다. 대시보드에서 켠 다음 여기에 넣으면 그대로 붙는다.
 *
 * **애플은 아이폰 앱 때문에 필수다.** 서드파티 로그인만 두면 애플이
 * 동등한 대안을 함께 두라고 요구한다(심사 가이드라인 4.8). 구글만
 * 두고 내면 반려된다.
 *
 * 애플 로그인의 client secret 은 **6개월마다 만료된다.** 만료되면
 * 애플만 조용히 죽고 구글은 멀쩡해서 한참 모른다 —
 * scripts/apple-secret.mts 로 다시 만들어 Supabase 에 넣는다.
 */
const ENABLED: Provider[] = ["google", "apple"];

export function SocialLogin({ next = "/my" }: { next?: string }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => setNative(isNativeIOS()), []);

  /**
   * **아이폰 앱에서는 소셜 로그인을 안 띄운다.**
   *
   * 앱 심사에서 이걸로 반려됐다(가이드라인 4). 구글 로그인은 우리
   * 도메인 밖(accounts.google.com)으로 나가는데, 웹뷰가 남의 주소를
   * 못 열게 막아 둬서 사파리가 통째로 열린다 — 앱을 쓰다가 갑자기
   * 브라우저로 튕기는 모양이 된다.
   *
   * 웹뷰 안에서 열게 풀 수도 없다. **구글이 임베디드 웹뷰의 OAuth 를
   * 거부한다**(disallowed_useragent). 제대로 고치려면 네이티브 쪽에
   * ASWebAuthenticationSession 을 붙여야 하는데, 그건 Xcode 작업이다.
   *
   * 그동안 아이폰에서는 이메일 로그인만 연다. 예매는 원래 로그인
   * 없이도 되므로 손님이 막히는 곳은 없다.
   */
  if (native) return null;

  async function go(provider: Provider) {
    setBusy(provider);
    setErr(null);
    const supabase = createClient();
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    /**
     * **잡아 둔 예매가 있을 때만 이어 붙인다.**
     *
     * 익명 세션에 신원을 붙이면(linkIdentity) 예매를 안 잃는 대신,
     * 계정에 "익명" 표시가 그대로 남는다. 그러면 구글 창까지 다 돌고
     * 와도 앱은 계속 로그아웃으로 본다 — DB 쪽 promote_anonymous 로
     * 표시를 내려야 비로소 로그인으로 보인다.
     *
     * 예매가 없는 사람에게까지 그 길을 태울 이유가 없다. 잃을 게
     * 없으니 그냥 새 계정으로 로그인시킨다 — 그 편이 확실하게 된다.
     */
    let hasBooking = false;
    if (user?.is_anonymous) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled");
      hasBooking = (count ?? 0) > 0;
    }

    if (user?.is_anonymous && hasBooking) {
      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo },
      });
      if (!error && data?.url) {
        location.href = data.url;
        return;
      }
    }

    // 익명 세션을 먼저 끊는다. 안 끊으면 새 로그인이 옛 세션과 섞인다
    if (user?.is_anonymous) await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setErr(
        error.message.includes("not enabled")
          ? "아직 준비 중인 로그인이에요."
          : error.message,
      );
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2.5">
      {ENABLED.map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy !== null}
          onClick={() => go(p)}
          className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold disabled:opacity-50 ${STYLE[p]}`}
        >
          <Icon p={p} />
          {busy === p ? "이동 중…" : LABEL[p]}
        </button>
      ))}
      {err ? (
        <p className="text-[13px] font-semibold text-hot">{err}</p>
      ) : null}
    </div>
  );
}
