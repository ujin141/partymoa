# 앱스토어 제출

App Store Connect 에 넣을 것들. 스크린샷은 `screenshots/` 에 있다.

`이건 우진이` 표시가 붙은 건 애플 계정이 있어야만 되는 것들이라 대신 못 한다.

---

## 1. 앱 정보

| | |
|---|---|
| 이름 | 파티모아 |
| 부제 | 서울 파티 사전예매 |
| 번들 ID | `io.partymoa.app` |
| 기본 언어 | 한국어 |
| 카테고리 | 엔터테인먼트 (2차: 라이프스타일) |
| 가격 | 무료 |
| 기기 | 아이폰 · 아이패드 |
| 최소 버전 | iOS 16.0 |
| 버전 | 1.0.0 (빌드 1) |

## 2. 연령 등급 — **17+ 로 잡는다**

술이 나오는 야간 파티를 다루고, 이용자끼리 글을 쓰는 게시판이 있다.
등급 설문에서 이렇게 답한다.

- 주류·담배·약물 사용 또는 언급 → **빈번/심함**
- 성적 내용 또는 노출 → **없음**
- 사용자 생성 콘텐츠 → **있음** (커뮤니티 게시판)

**낮춰 잡으면 나중에 등급 재조정으로 심사가 한 번 더 돈다.** 처음부터 17+ 가 빠르다.

## 3. 앱 설명

```
서울에서 열리는 파티를 한 곳에서 찾고, 미리 자리를 잡아 둡니다.

■ 자리는 서버가 잡습니다
정원과 남녀 비율을 서버가 셉니다. 마감된 자리가 다시 팔리는 일은
없습니다. 동시에 여럿이 마지막 한 자리를 눌러도 한 명만 들어갑니다.

■ 예매하고 24시간 안에 입금
계좌로 입금하면 호스트가 확인하고 확정됩니다. 24시간이 지나면 자동으로
취소되고 그 자리는 다음 사람에게 넘어갑니다.

■ 알림
입금이 확인되면 바로, 자리가 풀리기 세 시간 전에 한 번, 파티 당일
아침에 한 번. 예매한 건에 대해서만 갑니다. 광고는 따로 동의한 분에게만
보내고, 밤 9시부터 아침 8시까지는 보내지 않습니다.

■ 신호가 끊겨도 예매번호는 보입니다
입구에서 신호가 약해도 티켓 화면이 뜹니다.

■ 혼자 가도 됩니다
1인 참여를 환영하는 파티만 따로 모아 봅니다.
```

**빈 화면을 광고하지 않는다.** 찜·팔로우 화면은 아직 비어 있어서 설명에
넣지 않았다. 없는 걸 적으면 그 자체로 반려 사유가 된다.

## 4. 키워드 (100자)

```
파티,클럽,예매,사전예매,루프탑,풀파티,솔로파티,디제이,DJ,강남,홍대,이태원,나이트라이프,게스트
```

## 5. 심사 메모 — **여기가 제일 중요하다**

**영어로 적는다.** 심사자는 한국어를 못 읽는다. 앱 화면이 전부 한국어라
어디를 눌러야 하는지 좌표까지 적어 줘야 한다.

**4.8 이 맨 위에 와야 한다.** 2026-09-04 에 그걸로 반려됐다.

```
[Sign-in — Guideline 4.8]
This app does NOT use any third-party or social login service. The only
way to sign in is an email and password account issued by us.

Google sign-in exists on our website only. In the iOS app it is not
rendered at all, on any screen — guest, host, and operator. Please
verify: there is no Google, Facebook, or other third-party button
anywhere in the app.

Sign-in is also NOT required. Browsing, party details and booking all
work without an account. On the booking sheet, tap the dark button to
book with just a name and a phone number.

[Demo account]
The credentials in App Store Connect are for the host (organizer)
screens. To sign in:

  1. Bottom tab bar, rightmost tab "마이" (My)
  2. Tap "로그인" (Sign in)
  3. Enter the email and password from App Store Connect

The host screens are behind the link "파티를 여는 호스트라면 여기로"
at the bottom of that same screen.

[Payments]
Tickets are admission passes to physical, offline parties. The service
is consumed outside the app, so in-app purchase is not used: guests pay
by bank transfer and the organizer confirms receipt. No digital content
or subscriptions are sold.

[What the app does that the website cannot]
1. Push notifications. In Safari these require the site to be added to
   the Home Screen first; the app receives them as soon as it is
   installed. Sent on payment confirmation, three hours before the
   payment deadline, and on the morning of the party.
2. Offline ticket. Signal is weak at venue entrances. The booking number
   is stored on device and shown when the connection drops.

[User-generated content moderation]
Community posts and comments can be reported and users can be blocked.
Open a post and use the menu at the top right.
- Report: six reasons to choose from. Goes to the operator screen.
- Block: takes effect immediately, enforced server-side (Postgres RLS).
Reported content is reviewed and removed within 24 hours.

[Account deletion]
My tab > below 고객센터 (Support) > 계정 삭제 (Delete account).
```

## 6. 개인정보

- 개인정보 처리방침 URL — `https://www.partymoa.com/privacy`
- 이용약관 URL — `https://www.partymoa.com/terms`
- 계정 삭제 경로 — `https://www.partymoa.com/delete`

### 개인정보 라벨 (App Privacy)

`ios/App/App/PrivacyInfo.xcprivacy` 와 **같은 내용으로** 답해야 한다.
둘이 어긋나면 심사에서 잡힌다.

| App Store Connect 항목 | 어디서 나오나 | 연결됨 | 추적 |
|---|---|---|---|
| 연락처 정보 > **이름** | 예매자 실명 (`bookings.name`) | 예 | 아니오 |
| 연락처 정보 > **전화번호** | 예매 연락처 (`bookings.phone`) | 예 | 아니오 |
| 연락처 정보 > **이메일 주소** | 구글 로그인 · 호스트 신청서 | 예 | 아니오 |
| 식별자 > **사용자 ID** | 세션에 티켓을 붙인다 | 예 | 아니오 |
| 식별자 > **기기 ID** | 푸시 토큰 (`push_subscriptions.endpoint`) | 예 | 아니오 |
| 사용자 콘텐츠 > **기타 사용자 콘텐츠** | 커뮤니티 글 · 댓글 | 예 | 아니오 |
| 구입 > **구입 내역** | 무엇을 얼마에 (`bookings`) | 예 | 아니오 |
| 기타 데이터 > **기타 데이터 유형** | 성별 (성비 조절용) | 예 | 아니오 |

용도는 **앱 기능**만 고른다. **사용자 ID 와 기기 ID 두 개만 예외**로
`개발자의 광고 또는 마케팅` 을 같이 고른다 — 광고성 푸시를 보내는
기능이 있고, 그 대상을 이 둘로 고른다(marketing_targets). 동의를 받고
보내지만 용도는 마케팅이 맞다.

분석 · 타사 광고 · 제품 개인 맞춤화는 어디에도 해당 없다.

**고르면 안 되는 것** — 위치 · 사진 · 연락처 · 건강 · 재무 정보 ·
검색 기록 · 광고 데이터. 코드에 접근하는 곳이 없다.

"데이터를 추적에 사용합니까" → **아니오**. 추적 SDK 가 하나도 없다.

## 7. 스크린샷

**올리는 건 `upload/` 다.** `screenshots*/` 는 시뮬레이터에서 그대로
뽑은 원본이고, 여기에 문구를 얹어 `upload/` 를 만든다.

    upload/69/     1320 x 2868   아이폰 6.9인치
    upload/65/     1242 x 2688   아이폰 6.5인치
    upload/ipad13/ 2064 x 2752   아이패드 13인치

**아이패드도 올린다.** TARGETED_DEVICE_FAMILY 가 "1,2" 라
아이패드 스크린샷이 없으면 제출 자체가 안 된다.

문구를 고치려면 `scripts/store-shots.py` 의 SHOTS 를 고치고 다시 돌린다.

| 파일 | 문구 |
|---|---|
| `01-home` | 서울 파티, 한 곳에서 |
| `02-explore` | 혼자 가도 괜찮습니다 |
| `03-party` | 라인업부터 입금 계좌까지 |
| `04-booking` | 자리는 서버가 잡습니다 |
| `05-offline` | 신호가 끊겨도 티켓은 보입니다 |

**04 가 제일 중요하다.** 웹뷰 껍데기가 아니라 실제로 예매가 되는
앱이라는 증거다 — 가이드라인 4.2 를 볼 때 심사자가 이걸 본다.

**05 는 알림이 아니라 오프라인 티켓이다.** 서버에 APNs 키가 없는 동안
앱의 알림 화면은 "준비 중" 으로 뜬다. 안 되는 기능을 스토어에 걸 수는
없다. 키를 넣은 뒤에 알림 화면을 다시 찍어 바꾸면 된다.

## 8. 남은 위험 — 솔직하게

### 4.2 (최소 기능)

이 앱은 배포된 웹을 띄운다. 화면 34개가 force-dynamic 이고 서버
컴포넌트 48곳에서 Supabase 를 불러서 정적으로 뽑아 넣을 수가 없다.
그래서 **네이티브 알림과 오프라인 티켓이 통과의 조건**이지 장식이 아니다.
심사 메모에 그 두 가지를 반드시 적는다.

### 4.8 (로그인 서비스) — **2026-09-04 여기서 반려됐다**

앱에 서드파티 로그인이 하나라도 보이면, 애플은 동등한 대안(Sign in
with Apple 같은)을 **같은 화면에** 두라고 요구한다.

게스트 화면(`SocialLogin.tsx`)에는 네이티브 분기가 걸려 있었다. 그런데
**크루와 운영자 로그인에는 안 걸려 있었다.** 두 화면 다 구글 단독이었고,
크루 쪽은 `EMAIL_LOGIN = false` 라 정말 버튼이 그것 하나뿐이었다.
심사 메모가 심사자를 그 화면으로 안내했으니 정확히 거기서 걸렸다.

**고친 방향 — 앱에서 서드파티 로그인을 아예 없앤다.** 그러면 4.8 이
적용되지 않는다. 애플 버튼을 더하는 쪽은 택하지 않았다.

  · 구글 OAuth 는 **앱에서 어차피 안 된다.** 구글이 임베디드 웹뷰의
    OAuth 를 거부한다(disallowed_useragent). 죽은 버튼이었다
  · 크루 계정은 이메일로 발급한다. 애플 로그인을 붙이면 crew_members
    와 안 이어진 새 계정이 생긴다

    SocialLogin.tsx        앱에서 안 그림 (원래도 그랬다)
    crew/LoginForm.tsx     앱에서 구글 숨김 · EMAIL_LOGIN = true
    admin/AdminLoginForm   앱에서는 브라우저로 안내만

**`useNativeIOS()` 는 정해지기 전에 null 을 준다.** false 로 시작해서
useEffect 로 끄면 앱에서도 **한 프레임 동안 구글 버튼이 그려진다.**
심사자는 그 한 프레임을 캡처한다. 그래서 웹인 게 확실할 때만 그린다.

### 3.1.1 (앱 내 구입)

실물 행사 티켓은 앱 밖에서 소비되는 재화라 앱 내 구입 의무가 없는
것으로 본다. 다만 **제출 전에 3.1.5 "Goods and Services Outside of
the App" 조항을 직접 확인하는 게 맞다.** 여기서 걸리면 수수료 구조가
통째로 바뀐다.
