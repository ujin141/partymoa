# 맥북으로 옮기기 · iOS 앱스토어

## 1. 소스 옮기기

**압축해서 보내지 말 것.** `node_modules` 만 수백 MB 다. git 이 옮긴다.

```bash
git clone https://github.com/ujin141/partymoa.git
cd partymoa
corepack enable pnpm
pnpm install
```

## 2. git 에 없는 것 세 개 — 손으로 옮긴다

AirDrop 이나 USB 로. **메일·카톡·슬랙에 올리지 말 것.**

| 파일 | 왜 |
|---|---|
| `.env.local` | 없으면 아무것도 안 뜬다 |
| `android/android.keystore` | **다시 만들 수 없다.** 잃어버리면 Play 스토어의 그 앱을 영영 업데이트 못 한다 |
| `android/KEY.txt` | 위 keystore 비밀번호 |

`android/local.properties` 는 안 옮겨도 된다. Android Studio 가 다시 만든다.

`.env.local` 최소 세 줄. 이것만 있어도 앱은 뜬다.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

푸시까지 로컬에서 돌리려면 Vercel 프로젝트 설정에서 다섯 개를 더
가져온다 — `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` ·
`VAPID_SUBJECT` · `SUPABASE_SERVICE_ROLE_KEY` · `CRON_SECRET`.

## 3. 맥에 미리 깔아 둘 것

- **Xcode** (App Store 에서. 10GB 넘는다)
- **Apple Developer Program** — 연 $99. 없으면 심사 제출 자체가 안 된다
- Node 24 · pnpm 11
- CocoaPods (Capacitor 로 갈 경우)

---

## 4. 붙여 넣을 프롬프트

```
파티모아라는 파티 예매 서비스를 맥북으로 옮겨 왔어.
iOS 앱스토어에 올리는 게 목표야.

## 이 프로젝트

- Next.js 15 (App Router) + TypeScript + Tailwind 4 + Supabase. pnpm
- www.partymoa.com 으로 Vercel 에 배포돼 있고 **실제 손님이 예매 중인
  서비스다.** 2026년 8월 29일 행사에 실제로 쓰고 있다
- 게스트 앱(/)과 크루 관리자(/crew), 운영자(/admin) 세 갈래
- 게스트는 로그인 없이 예매한다 (Supabase 익명 로그인)
- 크루·운영자는 구글 OAuth 로 로그인한다

## 이미 되는 것

- PWA (public/sw.js, manifest)
- 웹 푸시. VAPID 키가 Vercel 에 들어가 있고 실제로 간다.
  입금 확인 즉시 / 입금 마감 3시간 전 / 파티 당일 아침, 세 가지
- 안드로이드: Bubblewrap TWA 로 만들어져 있다 (android/,
  패키지 com.partymoa.app). Play 스토어용 keystore 는 git 에 없다

## iOS 는 아무것도 없다

이번에 처음 만든다. 이게 이번 작업이다.

## 네가 못 하는 것 — 미리 알아 둬

- **크루 화면을 눈으로 못 본다.** 구글 OAuth 라 네가 로그인할 수 없다.
  /crew 아래를 고쳤으면 나한테 확인해 달라고 해
- **Supabase 를 직접 못 고친다.** 스키마를 바꿔야 하면 supabase/ 아래
  SQL 파일로 만들어 줘. 내가 SQL 편집기에서 직접 돌린다.
  그게 지금까지 하던 방식이고 파일이 여러 개 쌓여 있다

## 지킬 것

- **main 에 푸시하면 바로 실서비스에 배포된다.** 배포되는 변경은
  나한테 먼저 확인받아 줘
- **저장소가 공개다.** 손님 이름·전화번호·키를 커밋하지 마.
  supabase/ 의 SQL 템플릿은 표를 비워서 커밋한다
- android/android.keystore 는 절대 커밋하지 마
- 색은 app/globals.css 의 @theme 한 곳에서만 정의한다
- 정원·성비·금액은 서버(create_booking, tier_price)가 정한다.
  화면에서 계산해 통과시키지 마

## 첫 순서

1. pnpm install → pnpm dev 로 뜨는지 확인.
   .env.local 은 내가 손으로 옮겨 뒀어. 없거나 모자라면 말해 줘
2. pnpm build 통과하는지
3. iOS 를 어떻게 만들지 제안해 줘. Capacitor 처럼 웹앱을 감싸는 방식과
   다른 선택지를 비교해 주고, **애플 심사 가이드라인 4.2(minimum
   functionality)에 걸릴 위험을 솔직하게** 말해 줘.
   웹뷰만 씌운 앱은 반려된다고 들었어
4. 내가 고르면 그때 시작
```

---

## 5. 미리 알아 둘 것

**App Store 는 웹사이트를 그대로 감싼 앱을 반려한다** (가이드라인 4.2).
안드로이드 TWA 가 그냥 통과한 건 그쪽에 이 심사가 없어서다.

파티모아는 예매·티켓·입장이라는 실제 기능이 있어서 통과할 여지가 있지만,
**앱에서만 되는 게 하나는 있어야** 설득이 쉽다. 후보:

- 푸시 알림 — 이미 만들어져 있다. iOS 는 홈 화면에 추가해야만 웹 푸시가
  오는데, 네이티브 앱이면 그 제약이 없어진다. **이게 제일 자연스러운
  명분이다**
- 오프라인 티켓 — 입구에서 신호가 약해도 예매번호가 보여야 한다
- 홈 화면 위젯 — 다음 파티까지 남은 시간

## 6. 지금까지 겪은 것 (반복하지 말 것)

- `NEXT_PUBLIC_` 값은 **빌드할 때 코드에 박힌다.** 환경변수만 넣고
  Redeploy 하면 캐시된 결과물이 그대로 나가서 안 들어간다.
  캐시 없이 다시 빌드해야 한다
- 크론이 anon 키로 `push_targets` 를 부르면 권한 오류로 조용히 끝난다.
  서비스 롤로 불러야 한다 (lib/supabase/admin.ts)
- `timestamptz::date` 는 UTC 로 떨어진다. 자정 넘겨 시작하는 파티에서
  하루가 어긋난다. `at time zone 'Asia/Seoul'` 을 거쳐야 한다
