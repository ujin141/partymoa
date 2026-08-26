# 맥북으로 옮기기 · iOS 앱스토어

윈도우에서 만들던 걸 맥으로 옮겨 App Store 에 올리려고 한다.
아래 프롬프트를 맥의 Claude Code 에 그대로 붙여 넣는다.

---

## 옮기는 방법

**소스는 git 이 옮긴다.** 압축해서 보내지 말 것 — `node_modules` 만
수백 MB 다.

```bash
git clone https://github.com/ujin141/partymoa.git
cd partymoa
```

**git 에 없는 것 세 개는 손으로 옮긴다.** AirDrop 이나 USB 로.
메일·카톡·슬랙에 올리지 말 것.

| 파일 | 왜 |
|---|---|
| `.env.local` | Supabase 주소·키. 없으면 아무것도 안 뜬다 |
| `android/android.keystore` | **다시 만들 수 없다.** 잃어버리면 Play 스토어의 그 앱을 영영 업데이트 못 한다 |
| `android/KEY.txt` | 위 keystore 비밀번호 |

`android/local.properties` 는 안 옮겨도 된다. Android Studio 가 다시 만든다.

푸시 알림까지 로컬에서 돌리려면 Vercel 프로젝트 설정에서 네 개를 더
가져온다 — `VAPID_PRIVATE_KEY` · `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ·
`VAPID_SUBJECT` · `CRON_SECRET`.

---

## 붙여 넣을 프롬프트

```
파티모아라는 파티 예매 서비스를 맥북으로 옮겨 왔어. iOS 앱스토어에
올리는 게 목표야.

먼저 이걸 알아 둬:

- Next.js 15 + TypeScript + Tailwind 4 + Supabase. pnpm 을 쓴다
- www.partymoa.com 으로 Vercel 에 이미 배포돼 있고 **실제 손님이
  예매 중인 서비스다.** 2026년 8월 29일 행사에 실제로 쓰고 있다
- PWA 는 이미 된다 (public/sw.js, manifest)
- 안드로이드는 Bubblewrap TWA 로 이미 만들어져 있다 (android/,
  패키지 com.partymoa.app)
- **iOS 는 아무것도 없다.** 이번에 처음 만든다
- 저장소가 공개다. 손님 개인정보나 키를 커밋하면 안 된다

첫 순서:

1. pnpm install 하고 pnpm dev 로 뜨는지 확인해 줘.
   .env.local 은 내가 손으로 옮겨 뒀어. 없으면 말해 줘
2. pnpm build 가 통과하는지 확인
3. iOS 를 어떻게 만들지 제안해 줘. 지금 웹앱을 감싸는 방식(Capacitor
   같은)과 다른 선택지가 있으면 비교해서 알려줘.
   **애플 심사 가이드라인 4.2(minimum functionality)에 걸릴
   위험이 있는지 솔직하게 말해 줘** — 웹뷰만 씌운 앱은 반려된다고
   들었어
4. 내가 고르면 그때 시작

작업할 때 지킬 것:

- **실서비스가 돌고 있다.** main 에 푸시하면 바로 배포된다.
  배포되는 변경은 나한테 먼저 확인받아 줘
- Supabase 스키마를 바꿔야 하면 supabase/ 아래 SQL 파일로 만들어 줘.
  내가 Supabase SQL 편집기에서 직접 돌린다. 그게 지금까지 하던 방식이야
- android/android.keystore 는 절대 커밋하지 마
```

---

## 맥에서 미리 준비해 둘 것

- **Xcode** (App Store 에서 설치, 10GB 넘는다)
- **Apple Developer Program** — 연 $99. 없으면 심사 제출 자체가 안 된다
- Node 24, pnpm 11 (`corepack enable pnpm`)
- CocoaPods (Capacitor 로 갈 경우)

## 미리 알아 둘 것

App Store 는 **웹사이트를 그대로 감싼 앱을 반려한다** (가이드라인 4.2).
파티모아는 예매·티켓·입장이라는 실제 기능이 있어서 통과할 여지가 있지만,
푸시 알림·오프라인 티켓·홈 화면 위젯처럼 앱에서만 되는 게 하나는 있어야
설득이 쉽다. 안드로이드 TWA 는 이 심사가 없어서 그냥 통과한 것이다.
