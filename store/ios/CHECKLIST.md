# 우진이 해야 하는 것

애플 계정이 있어야만 되는 것들이라 대신 못 한다. **순서대로** 하는 게 빠르다.
앞의 것이 안 끝나면 뒤의 것을 시작할 수 없다.

---

## 1. Apple Developer Program 가입 — **오늘 신청한다**

<https://developer.apple.com/programs/> · 연 $99

**여기서 막히면 나머지 전부가 못 움직인다.** 서명도, 알림 키도, Apple
로그인 키도, 심사 제출도 전부 이 계정에서 나온다.

- 개인으로 넣으면 보통 하루~이틀
- 사업자로 넣으면 D-U-N-S 번호가 필요해서 몇 주 걸릴 수 있다

승인 메일이 오면 2번부터.

## 2. Xcode 에 계정 연결

Xcode → Settings → Accounts → `+` → Apple ID 로 로그인.

그다음 `ios/App/App.xcodeproj` 를 열고 App 타겟 → Signing & Capabilities
에서 Team 을 고른다. **Automatically manage signing 은 켜 둔다.**

여기까지 하면 실기기에 설치가 된다.

## 3. Push Notifications 켜기

같은 화면(Signing & Capabilities) 왼쪽 위 `+ Capability` → Push Notifications.

`aps-environment` 는 이미 파일로 넣어 뒀다(개발용 · 운영용 두 개).
Xcode 가 App ID 에 푸시를 켜 주는 게 이 단계의 목적이다.

## 4. APNs 키 만들기 (`.p8`)

<https://developer.apple.com/account/resources/authkeys/list>

`+` → 이름 아무거나 → **Apple Push Notifications service (APNs)** 체크 → 등록.

**`.p8` 파일은 한 번만 받을 수 있다.** 다시 못 받는다. 안전한 곳에 둔다.
같이 적어 둘 것 — Key ID(10자), Team ID(10자, 우측 상단).

받은 값을 Vercel 환경변수에 넣는다 (Production).

```
APNS_KEY_ID       키 ID
APNS_TEAM_ID      팀 ID
APNS_PRIVATE_KEY  .p8 파일 내용 통째로 (-----BEGIN 부터 끝까지)
APNS_PRODUCTION   true
```

**`NEXT_PUBLIC_` 이 아니므로 재배포만 하면 반영된다.**

## 5. Supabase 에 SQL 돌리기

Supabase → SQL Editor 에 `supabase/PUSH_APNS.sql` 을 붙여 넣고 실행.

기기 종류(`platform`) 칸을 늘리고, 보낼 대상을 고르는 함수 두 개를 다시
만든다. **두 번 돌려도 안전하다.** 맨 아래 확인 쿼리가 기기 수를 찍는다.

## 6. Sign in with Apple — **이걸 안 하면 반려된다**

지금 로그인이 구글 하나뿐이다. 애플은 서드파티 로그인만 두면 동등한
대안을 함께 두라고 요구한다(가이드라인 4.8).

**순서를 지킨다. 바꾸면 손님 화면에 "provider is not enabled" 가 뜬다.**

1. <https://developer.apple.com/account/resources/identifiers/list/serviceId>
   에서 Service ID 를 만든다. Return URL 은
   `https://rmdutafzihmizwdmixzv.supabase.co/auth/v1/callback`
2. Keys 에서 **Sign in with Apple** 키(`.p8`)를 만든다
3. Supabase → Authentication → Sign In / Providers → Apple 을 켜고
   Service ID · Team ID · Key ID · `.p8` 를 넣는다
4. **그다음에** `components/SocialLogin.tsx` 의 `ENABLED` 를
   `["google", "apple"]` 로 바꾼다

4번은 내가 해도 된다. 1~3 이 끝나면 말해 달라.

## 7. App Store Connect 에 앱 등록

<https://appstoreconnect.apple.com> → 앱 → `+` → 신규 앱

번들 ID `io.partymoa.app` 를 고르고, `store/ios/SUBMIT.md` 의 내용을
채운다. 연령 등급은 **17+** 로 잡는다(술이 나오는 야간 파티 + 게시판).

## 8. 업로드

Xcode → Product → Destination 을 `Any iOS Device` 로 → Product → Archive
→ Distribute App → App Store Connect.

**Release 빌드는 운영 APNs 를 쓴다.** Vercel 의 `APNS_PRODUCTION` 이
`true` 여야 짝이 맞는다. 한쪽만 바꾸면 알림이 조용히 안 간다.

---

## 그 밖에

- **빈 Vercel 프로젝트 `spot-country/partymoa` 삭제** — 내가 실수로 만들었다.
  배포가 없는 껍데기라 급하진 않지만 헷갈린다. 삭제 명령이 막혀 있어
  내가 못 지운다
- **찜 · 팔로우 화면이 비어 있다**(`/my/favorites`, `/my/crews`).
  심사자가 눌러 보고 빈 화면이 나오면 그 자체로 걸릴 수 있다.
  채우거나, 메뉴에서 잠시 빼는 게 안전하다
- **커뮤니티에 운영자 도구가 없다.** 지금은 본인 삭제만 있다.
  사용자 글이 있는 앱에 신고 · 차단이 없으면 가이드라인 1.2 로 걸린다.
  **이건 4.8 다음으로 위험하다**

## 내가 확인한 것 / 못 한 것

| | |
|---|---|
| 앱이 시뮬레이터에서 뜨고 실서비스를 띄운다 | 확인 |
| 안전영역 · 네비 위치 | 확인 (홈 · 둘러보기 · 내 티켓 · 마이) |
| 오프라인 티켓 | 확인 (연결을 끊고 저장된 번호가 그려지는 것까지) |
| 알림이 네이티브 경로를 탄다 | 확인 (플러그인이 붙어 있고 권한 요청까지 감) |
| **APNs 토큰 발급** | **못 함 — 서명이 없으면 애플이 토큰을 안 준다** |
| **실제 알림 전송** | **못 함 — 토큰과 `.p8` 이 있어야 한다** |
| **실기기 동작** | **못 함 — 계정이 있어야 설치된다** |

3 · 4번이 끝나면 실기기에서 알림 한 통을 실제로 보내 보는 게 좋다.
그게 되는 걸 보기 전에는 알림이 된다고 말할 수 없다.
