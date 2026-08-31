# 앱 심사 반려 1차 — 대응

제출 ID `05299c0f-6c68-48f2-9780-3d005b1a6c98` · 2026-09-01 · iPad Air 11" (M3)

세 건이다. **웹은 고쳐서 배포했다.** 남은 건 App Store Connect 입력과
화면 녹화, 그리고 Xcode 쪽 선택 사항 하나다.

---

## 1. 가이드라인 4 — 소셜 로그인이 사파리를 연다

### 왜 그랬나

구글 로그인은 `accounts.google.com` 으로 나간다. 웹뷰는 우리 도메인
밖으로 못 나가게 막혀 있어서(`capacitor.config.ts` 의 `allowNavigation`)
사파리가 통째로 열린다. 앱을 쓰다가 브라우저로 튕기는 모양이다.

**웹뷰 안에서 열게 푸는 건 답이 아니다.** 구글이 임베디드 웹뷰의
OAuth 를 거부한다(`disallowed_useragent`). 열어 줘도 로그인이 안 된다.

### 지금 한 것 — 배포 완료

아이폰 앱에서는 **소셜 로그인을 안 띄우고 이메일 로그인을 펴 둔다.**
웹에서는 그대로 구글·애플이 보인다.

    components/SocialLogin.tsx    isNativeIOS() 면 null
    components/PasswordLogin.tsx  isNativeIOS() 면 처음부터 열림

예매는 원래 로그인 없이도 되므로 손님이 막히는 곳은 없다. 로그인이
필요한 건 기기 간 티켓 이어받기·찜·호스트 화면뿐이다.

### 나중에 제대로 할 것 (Xcode · 선택)

구글 로그인을 아이폰에서도 쓰려면 `ASWebAuthenticationSession` 이
필요하다. 애플이 답장에서 권한 Safari View Controller 가 이것이다.

    1. Capacitor 플러그인 `@capacitor/browser` 설치
    2. SocialLogin 에서 native 면 supabase.auth.signInWithOAuth 를
       skipBrowserRedirect: true 로 부르고, 받은 url 을 Browser.open
    3. Supabase redirect 를 커스텀 스킴(io.partymoa.app://auth)으로 두고
       AppDelegate 에서 열린 url 을 웹뷰로 넘긴다

**이번 재심사에는 없어도 된다.** 소셜 로그인이 아예 안 보이면 지적할
대상이 없다.

---

## 2. 가이드라인 2.1(a) — 심사용 계정

앱에 이메일 로그인 문이 이미 있다(`PasswordLogin`). 로그인 화면에서
**이메일로 로그인** 을 누르면 열린다. 아이폰에서는 처음부터 펴져 있다.

### 해야 할 일

1. Supabase 대시보드 → Authentication → Users → **Add user**
   - 이메일 `review@partymoa.com` (아무 주소나. 실제 수신 안 해도 된다)
   - 비밀번호는 길게. **Auto Confirm User 를 켤 것** — 안 켜면 메일
     인증을 못 해서 로그인이 안 된다
2. `supabase/REVIEW_ACCOUNT.sql` 을 돌린다 — 그 계정을 크루 스태프로
   넣어서 호스트 화면까지 보이게 한다
3. App Store Connect → 앱 정보 → **App Review Information**
   - 사용자 이름 / 암호에 위 계정
   - 메모란에 아래 안내를 붙인다

### 메모란에 넣을 글

    로그인 없이도 대부분의 기능을 쓸 수 있습니다. 홈 · 둘러보기 ·
    파티 상세 · 예매 · 커뮤니티는 로그인 없이 동작합니다.

    호스트(주최자) 화면을 보시려면 아래 계정으로 로그인해 주세요.
    로그인 화면에서 "이메일로 로그인"을 누르면 앱 안에서 입력할 수
    있습니다. 외부 브라우저로 나가지 않습니다.

      ID  review@partymoa.com
      PW  (여기에 비밀번호)

    로그인 후 마이 → 호스트 화면으로 들어가면 예매 명단, 입금 확인,
    입장 체크, 정산까지 볼 수 있습니다.

    ⚠ 이 앱은 실제 파티 예매를 받습니다. 예매 테스트는 자유롭게 하셔도
    되며, 남은 자리는 저희가 되돌립니다.

### 미리 채워 둘 것

애플이 "pre-populated content" 를 요구했다. 지금 상태로는 **파는 파티가
하나도 없어서 홈이 비어 보인다.** 심사자가 예매를 못 해 본다.

    supabase/AFTER_MOON.sql 을 돌리고 status 를 open 으로 바꿀 것

이게 이번 재심사에서 제일 중요하다. 파티가 없으면 예매·티켓·쿠폰을
아무것도 못 보여 준다.

---

## 3. 가이드라인 1.2 — UGC 안전장치

### 이미 있던 것

- 신고 (`components/community/ReportMenu.tsx` · `report_content` RPC)
- 차단 (`block_author` RPC — 누르면 그 사람 글이 즉시 안 보인다)
- 운영자 화면 (`/admin` 에서 신고 목록 확인)

### 이번에 더한 것 — 배포 완료

**약관에 무관용 조항.** 5조를 다시 썼다. 무엇이 금지인지(욕설·혐오·
성적 내용·위협·신상 유포·사칭), 신고가 오면 24시간 안에 내리고
반복되면 예고 없이 정지한다는 것까지 적었다.

**로그인 전 동의.** 체크를 해야 로그인 버튼이 눌린다. 예전에는 버튼
아래 "로그인하면 동의하는 것으로 봅니다" 한 줄이었는데, 그건 읽은 적
없는 사람에게 동의를 씌우는 문장이라 심사에서 동의로 안 쳐 준다.

**글쓰기 전 동의.** 이 앱은 **로그인 없이도 커뮤니티 글이 써진다.**
그래서 로그인 화면에만 두면 한 번도 로그인 안 한 사람에게는 안 걸린다.
작성기를 열면 규칙을 먼저 보여 주고 `동의하고 글쓰기` 를 눌러야 넘어간다.

### 화면 녹화 (실기기에서 찍을 것)

애플이 세 장면을 요구했다. **하나의 영상**에 순서대로 담으면 된다.

    1. 약관 동의
       앱 실행 → 마이 → 로그인
       → 동의 체크가 비어 있고 버튼이 흐린 것을 보여 준다
       → 체크를 누르면 버튼이 켜지는 것을 보여 준다
       → "이용약관" 을 눌러 무관용 조항(5조)까지 스크롤

    2. 신고
       커뮤니티 → 아무 글의 오른쪽 ⋯ → 신고
       → 이유를 적고 보내는 것까지

    3. 차단
       같은 메뉴에서 차단
       → 그 사람 글이 목록에서 사라지는 것까지 보여 준다

    (덤) 글쓰기 전 동의
       커뮤니티 → "무슨 얘기든 편하게 써 주세요"
       → 규칙 화면과 "동의하고 글쓰기"

시뮬레이터로 찍으면 안 받아 준다 — **실기기**여야 한다.
영상은 App Store Connect → App Review Information → Notes 에 넣는다.

---

## 답장 초안

App Store Connect 의 해당 메시지에 답장으로 붙인다.

    Hello,

    Thank you for the review. We have addressed all three items.

    **Guideline 4 — Social login**
    Social sign-in no longer appears in the iOS app. Users sign in with
    email and password entirely inside the app; the app never opens an
    external browser. (Google's OAuth endpoint refuses embedded
    web views, so we removed the option on iOS rather than degrade the
    experience.) Account deletion is available in-app under
    마이 → 계정 삭제.

    **Guideline 2.1(a) — Demo account**
    Credentials are provided in App Review Information. Most of the app
    works without signing in (browse, book, community). The account
    above unlocks the host dashboard: guest list, payment confirmation,
    check-in and settlement. A live party with seats, tickets and
    coupons is now published so every screen has real content.

    **Guideline 1.2 — User-generated content**
    - Terms now state explicitly that there is zero tolerance for
      objectionable content and abusive users, and describe removal
      within 24 hours and suspension for repeat offenders.
    - Users must tick an agreement checkbox before signing in.
    - Because posting does not require an account in our app, we also
      show the rules and require agreement before a user's first post.
    - Reporting and blocking are available on every post and comment
      via the ⋯ menu. Blocking hides that user's content immediately.

    A screen recording captured on a physical device is attached in the
    Notes field.

    Thank you.

---

## 순서

    1. supabase/AFTER_MOON.sql       파티를 만들고 open 으로
    2. Supabase 에서 심사 계정 생성   Auto Confirm 켜기
    3. supabase/REVIEW_ACCOUNT.sql   그 계정을 크루 스태프로
    4. 실기기 화면 녹화 (위 세 장면)
    5. App Store Connect 에 계정 · 메모 · 영상 넣고 답장
    6. 빌드는 다시 안 올려도 된다 — 웹이 바뀌면 앱도 같이 바뀐다
