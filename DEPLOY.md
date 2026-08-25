# 배포

Vercel + Supabase. 아래 순서대로 하면 된다.

## 1. Supabase

새 프로젝트를 쓰는 경우, `supabase/migrations/` 를 **번호 순서대로** 올린다.

```bash
pnpm dlx supabase link --project-ref <ref>
pnpm dlx supabase db push
```

대시보드에서 직접 붙여 넣어도 된다. 순서가 중요하다 — RLS 가 앞 파일의
테이블을 참조한다.

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

    Site URL          https://partymoa.com
    Redirect URLs     https://partymoa.com/auth/callback

## 2. 운영자 계정

운영 화면(`/admin`)은 `app_admins` 에 있는 사람만 들어간다.
대표가 `/crew/login` 에서 먼저 로그인해 계정을 만든 뒤:

```sql
insert into app_admins (user_id, note)
select id, '운영자' from auth.users where email = 'you@example.com';
```

## 3. Vercel

저장소를 연결하고 환경변수 세 개를 넣는다.

    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    NEXT_PUBLIC_SITE_URL          (도메인을 붙였으면)

빌드 설정은 손댈 게 없다. Next 를 자동으로 잡는다.

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
