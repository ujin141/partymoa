# 배포

Vercel + Supabase. 아래 순서대로 하면 된다.

## 1. Supabase

새 프로젝트를 쓰는 경우, 대시보드 **SQL Editor** 에 두 파일을 순서대로
붙여넣고 Run 한다.

    1. supabase/ALL.sql        스키마 · RLS · 예매 함수 · 크론 · 운영자
    2. supabase/INIT_DATA.sql  첫 행사 데이터 (⬛ 표시한 자리를 채운 뒤)

INIT_DATA 를 돌리기 전에 크루 대표 계정이 있어야 한다.
**`/crew/login` 에서는 못 만든다** — 회원가입이 없고 있는 계정으로
들어가는 화면이다. 대시보드에서 만든다.

    Authentication → Users → Add user → Create new user
      Email / Password 를 넣고
      Auto Confirm User ✅   ← 안 켜면 메일 인증 전까지 로그인이 안 된다

CLI 를 쓴다면 아래도 같다.

```bash
pnpm dlx supabase link --project-ref <ref>
pnpm dlx supabase db push
```

어느 쪽이든 순서가 중요하다 — RLS 가 앞 파일의 테이블을 참조한다.

그 다음 대시보드에서 두 개를 켠다.

    Authentication > Sign In / Providers
      Anonymous sign-ins        켠다. 안 켜면 예매가 세션에 안 붙어
                                내 티켓이 비고, 커뮤니티 글을 본인도 못 지운다
      Manual linking            켠다. 익명으로 예매한 사람이 나중에 로그인할 때
                                계정을 이어 붙인다. 안 켜면 로그인하는 순간
                                새 계정이 생겨 **그 전 티켓이 사라진다**

소셜 로그인을 쓸 거면 같은 화면에서 카카오·구글·애플을 켜고 키를 넣는다.
리디렉션 주소는 셋 다 하나다.

    https://<ref>.supabase.co/auth/v1/callback

마지막으로 **URL Configuration** 에 배포 주소를 넣는다. 안 넣으면 로그인
후 localhost 로 돌아온다.

    Site URL          https://www.partymoa.com
    Redirect URLs     https://www.partymoa.com/**
                      (미리보기 배포를 쓸 거면 https://*.vercel.app/** 도)

## 2. 운영자 계정

운영 화면(`/admin`)은 `app_admins` 에 있는 사람만 들어간다.
INIT_DATA.sql 이 크루 대표를 운영자로도 넣는다. 다른 사람을 더 넣으려면:

```sql
insert into app_admins (user_id, note)
select id, '운영자' from auth.users where email = 'you@example.com';
```

## 3. Vercel

저장소를 연결하고 환경변수 세 개를 넣는다.

    NEXT_PUBLIC_SUPABASE_URL       https://efvcciopdgrqbjlhkfwq.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY  sb_publishable_...
    NEXT_PUBLIC_SITE_URL           https://www.partymoa.com

빌드 설정은 손댈 게 없다. Next 를 자동으로 잡는다.

## 3-1. 도메인 (partymoa.com)

가비아에서 산 도메인이라 네임서버가 가비아를 보고 있다.
**가비아 DNS 관리에서 레코드 두 개**를 넣는다. 네임서버 자체를 Vercel 로
넘길 필요는 없다.

    타입    호스트   값
    A       @        76.76.21.21
    CNAME   www      cname.vercel-dns.com

그 다음 Vercel > Settings > Domains 에 `partymoa.com` 과 `www.partymoa.com`
을 추가한다. 하나를 다른 하나로 리다이렉트하도록 두는 게 좋다 —
**둘 다 열어 두면 로그인 세션 쿠키가 갈린다.**

값은 Vercel 이 도메인을 추가할 때 화면에 다시 알려 준다. 위 IP 가 다르면
화면에 뜬 값을 따른다.

전파는 보통 몇 분에서 한 시간이다. `nslookup partymoa.com` 으로 확인한다.

## 4. 올리기 전 확인

- [ ] `pnpm build` 가 로컬에서 통과하는가
- [ ] 예매를 한 번 해 보고 완료 화면에 **계좌·입금자명·마감**이 다 뜨는가
- [ ] 크루 계정으로 입금 확인 → 입장 처리가 되는가
- [ ] 명단 CSV 를 엑셀에서 열었을 때 한글이 안 깨지는가
- [ ] 카톡에 링크를 던졌을 때 미리보기 카드가 뜨는가 (`NEXT_PUBLIC_SITE_URL`)
- [ ] `/crew`, `/admin` 이 로그아웃 상태에서 막히는가
- [ ] 시드 데이터(`supabase/seed.sql`)가 프로덕션에 안 들어갔는가

## 5. 실제 값으로 바꿀 것

시드에는 사양서 8절의 임시값이 들어 있다. 크루 관리에서 바꾼다.

    행사 날짜 · 셋타임 · 가격 · 정원 · 입금 계좌 · 대관료
    커버 이미지 (지금은 Unsplash 사진이다)
    크루 인스타 핸들
