# 파티모아 (PARTYMOA)

서울 언더그라운드 파티 사전예매 플랫폼. 크루는 파티를 등록해 예매·정산·입장
확인을 하고, 이용자는 흩어진 파티를 한 곳에서 찾아 예매한다. 수수료 7%.

첫 목표는 **2026년 8월 BLACKOUT 행사에 실제로 쓰는 것**이다. 예매 → 입금확인
→ 입장확인, 이 흐름이 확실히 도는 게 나머지 전부보다 우선이다.

## 돌리기

```bash
pnpm install
cp .env.local.example .env.local   # 값을 채운다
pnpm dev                           # http://localhost:3000
```

크루 화면은 `/crew`, 게스트 앱은 `/`.

## 이 저장소에서 지켜야 할 것

**정원·성비·차수를 클라이언트에서 검증하지 않는다.**
전부 `create_booking` 안에서 events 행을 잠그고 다시 센다. 화면의 계산
(`lib/rules.ts`)은 버튼을 흐리게 하는 용도일 뿐이고, 화면이 통과시켜도 서버가
막으면 서버가 이긴다. 동시에 넷이 마지막 자리를 눌러도 하나만 성공하는 걸
확인해 뒀다.

**잔여를 저장하지 않는다.** `event_stats` · `tier_stats` 뷰가 매번 센다.
그래서 자동 취소가 `status`만 바꿔도 정원·성별·차수가 함께 되돌아온다.
숫자를 컬럼에 들고 있으면 취소·환불에서 반드시 어긋난다.

**금액도 서버가 정한다.** 클라이언트가 보낸 금액은 쓰지 않는다.
남성가 = 차수가 × `male_price_multiplier`, 천 원 단위 반올림.

**성별은 성비 조절에만 쓴다.** 공개 화면에 개인 단위로 노출하지 않는다.

**색은 `app/globals.css` 의 `@theme` 한 곳에서만 정의한다.**

## 구조

```
app/(guest)/          게스트 앱 — 홈 · 둘러보기 · 커뮤니티 · 내 티켓 · 마이
app/(crew)/crew/      크루 관리자 — 현황 · 명단 · 입장 · 정산 · 파티 등록
app/api/bookings/     예매 생성(POST) · 티켓 찾기(find)
components/           공통 컴포넌트. crew/ 아래는 관리자 전용
lib/rules.ts          도메인 규칙 — 수수료율·성별 정원·가격·할인율
lib/queries.ts        게스트 조회
lib/community.ts      게시판 조회
lib/crew.ts           크루 조회
supabase/migrations/  스키마 · RLS · 지출 · 크론
supabase/seed.sql     로컬 시드 (임시값이다. 프로덕션에 넣지 말 것)
```

## 행사 당일에 쓰는 흐름

첫 목표가 실제 행사라서, 손님이 헤매거나 입구에 줄이 서는 자리를 먼저 막았다.

    예매 직후    시트가 완료 화면으로 바뀐다 — **얼마를 / 어디로 / 언제까지**
                 셋만 말한다. 목록으로 넘기면 이 셋이 눌려 보여 그냥 지나친다
    입금 대기    내 티켓에 마감 시각과 남은 시간이 같이 뜬다
    입금 독촉    명단 > 미입금 에서 연락처를 한 번에 복사한다.
                 행마다 전화·문자 링크가 걸려 있다
    현장 입장    예매번호 **뒷자리만** 쳐도 찾는다 (7 → PM0007).
                 처리하면 검색창이 비고 커서가 돌아온다 — 다음 손님 바로
                 방금 처리한 건은 되돌리기 버튼이 남는다
    스태프 여럿  Realtime 으로 서로의 처리가 바로 반영된다

## 데이터 흐름

```
게스트 예매 →  POST /api/bookings
            →  create_booking RPC   ← 여기서만 자리가 잡힌다
            →  bookings.status = 'pending', expires_at = +24h

크루 입금확인 →  bookings.status = 'paid'
현장 입장     →  bookings.status = 'checked_in'   (미입금이면 경고 한 번)
24시간 초과   →  pg_cron 10분마다 expire_unpaid_bookings()
              →  status = 'cancelled' → 정원 자동 반환
```

## 환경변수

`.env.local` 은 `.gitignore` 에 걸려 있다. 새 기기에서는 손으로 만든다.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

푸시까지 돌리려면 다섯 개가 더 필요하다. **하나라도 없으면 알림이
조용히 안 간다** — 알림은 곁다리라, 키가 없다고 예매 같은 진짜 일이
막히면 안 되기 때문이다.

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY   npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY              같은 명령이 같이 뱉는다
VAPID_SUBJECT                  mailto:주소
SUPABASE_SERVICE_ROLE_KEY      크론이 push_targets 를 부를 때만 쓴다
CRON_SECRET                    비우면 누구나 손님에게 알림을 울릴 수 있다
```

**VAPID 키를 나중에 바꾸면 기존 구독이 전부 죽는다.** 한 번 만들어서
계속 쓴다.

`NEXT_PUBLIC_` 이 붙은 값은 빌드에 박힌다 — 바꾸면 재배포해야 한다.

## 남은 설정

- [ ] Supabase 대시보드에서 **익명 로그인(Anonymous sign-ins)** 켜기.
      켜야 예매가 세션에 붙어 `내 티켓`에 자동으로 뜬다. 꺼져 있어도
      예매·입장은 다 되고, 손님은 `예매번호 + 연락처`로 티켓을 찾는다.
- [ ] **소셜 로그인 제공자 등록.** 화면과 코드는 다 있고 키만 없다.
      Supabase 대시보드 > Authentication > Sign In / Providers 에서 켠다.
      리디렉션 주소는 셋 다 아래 하나다.
      `https://efvcciopdgrqbjlhkfwq.supabase.co/auth/v1/callback`

      카카오  developers.kakao.com 에서 앱 생성 → 카카오 로그인 활성화
              → REST API 키 + Client Secret. 동의항목에 계정 이메일 추가
      구글    Google Cloud Console > OAuth 동의 화면 + 사용자 인증 정보
              → 웹 클라이언트 ID + Secret
      애플    Apple Developer 유료 계정(연 $99)이 필요하다. Service ID 와
              Key(.p8) 를 만들어 Team ID · Key ID 와 함께 넣는다.
              **없으면 애플 버튼만 빼면 된다** — SocialLogin.tsx 의 배열에서
              'apple' 을 지우면 끝이다
- [ ] Supabase 대시보드에서 **Manual linking** 켜기.
      익명으로 예매한 사람이 나중에 로그인할 때 계정을 잇는 데 쓴다.
      안 켜면 로그인 순간 새 계정이 생겨 **그 전 티켓이 안 보인다**
- [ ] 크루 계정 발급 — 지금은 SQL 로 넣는다. 회원가입 화면은 없다
- [ ] 커스텀 SMTP (Supabase 기본은 시간당 2통이라 비밀번호 재설정이 막힌다)
- [ ] 커버 이미지 업로드 (지금은 주소를 붙여 넣는다)
- [ ] 찜 · 팔로우 화면 (`/my/favorites`, `/my/crews` 는 아직 비었다)
- [ ] 커뮤니티 신고·숨김. 지금은 본인 삭제만 있고 운영자 도구가 없다
- [ ] PG 연동 — 초기에는 계좌이체 + 수동 입금 확인으로 간다

## 실제 값으로 채울 것

`supabase/seed.sql` 과 시드로 들어간 행사에는 임시값이 있다.
행사 날짜·셋타임·가격·정원·입금 계좌·대관료를 크루 관리자에서 바꾼다.
커버 이미지는 Unsplash 사진이라 실제 행사 사진으로 교체하는 게 좋다.
