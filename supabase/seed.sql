-- 로컬 개발용 시드. **실제 값이 아니다** — 사양서 8절의 임시값이 그대로
-- 들어 있다. 프로덕션에 넣지 말 것.
--
--   supabase db reset   →  마이그레이션 + 이 파일이 함께 돈다

-- 크루 소유자 계정. 로컬에서는 매직 링크 대신 이 계정으로 바로 들어간다
-- **토큰 컬럼을 빈 문자열로 채워야 한다.** null 로 두면 GoTrue 가
-- 로그인할 때 "Database error querying schema" 로 죽는다. 한 번 당했다.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current,
                        email_change, phone_change, phone_change_token,
                        reauthentication_token, is_sso_user, is_anonymous)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'crew@blackout.test',
  crypt('partymoa1234', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', '', false, false
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data,
                             created_at, updated_at)
values (
  gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a1', 'email',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"crew@blackout.test"}',
  now(), now()
) on conflict do nothing;

insert into crews (id, slug, name, bio, instagram, owner_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'blackout', 'BLACKOUT',
   '서울 기반 DJ 크루', 'blackout_crew',
   '00000000-0000-0000-0000-0000000000a1');

insert into crew_members (crew_id, user_id, display_name, invite_code, role) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'AROS', 'AROS', 'owner'),
  ('00000000-0000-0000-0000-0000000000c1', null, 'LYNN', 'LYNN', 'member'),
  ('00000000-0000-0000-0000-0000000000c1', null, 'TS',   'TS',   'member'),
  ('00000000-0000-0000-0000-0000000000c1', null, 'V',    'V',    'member');

insert into events (
  id, crew_id, slug, title, subtitle, description, cover_url,
  venue_name, area, address, starts_at, ends_at, capacity,
  gender_balanced, male_price_multiplier, solo_friendly,
  genres, categories, list_price, bank_account, status
) values (
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000c1',
  'after-sunset-20260829',
  'AFTER SUNSET 야외 풀파티',
  '해질녘부터 자정까지, 어나더 라운지 야외 풀장',
  E'해가 지는 시간에 시작합니다.\n\n낮에는 물, 밤에는 조명. 같은 공간이 두 번 바뀝니다.\n혼자 와도 됩니다 — 자리 잡아 드려요.',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=70',
  '어나더 루프탑 라운지', '양재', '서울 서초구 양재동',
  '2026-08-29 17:00+09', '2026-08-30 00:00+09', 80,
  true, 1.25, true,
  '{"하우스","테크노"}', '{"풀파티","루프탑"}',
  59000, '국민 123456-78-901234 (김우진)', 'open'
);

insert into ticket_tiers (event_id, name, note, price, capacity, sort_order) values
  ('00000000-0000-0000-0000-0000000000e1', '1차 얼리버드', '선착순 40명', 39000, 40, 0),
  ('00000000-0000-0000-0000-0000000000e1', '2차 사전예매', null,          49000, 30, 1),
  ('00000000-0000-0000-0000-0000000000e1', '3차 사전예매', '마지막 차수',  59000, 10, 2);

insert into lineups (event_id, artist_name, starts_at, sort_order) values
  ('00000000-0000-0000-0000-0000000000e1', 'AROS', '17:00', 0),
  ('00000000-0000-0000-0000-0000000000e1', 'LYNN', '18:30', 1),
  ('00000000-0000-0000-0000-0000000000e1', 'TS',   '20:00', 2),
  ('00000000-0000-0000-0000-0000000000e1', 'V',    '21:30', 3);

-- 다른 크루 하나 — 홈 큐레이션이 한 줄만 나오면 확인이 안 된다
insert into crews (id, slug, name, bio, owner_id) values
  ('00000000-0000-0000-0000-0000000000c2', 'sublevel', 'SUBLEVEL',
   '을지로 지하 테크노', '00000000-0000-0000-0000-0000000000a1');

insert into events (
  id, crew_id, slug, title, subtitle, cover_url, venue_name, area,
  starts_at, ends_at, capacity, gender_balanced, solo_friendly,
  genres, categories, list_price, bank_account, status
) values (
  '00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-0000000000c2',
  'basement-004-20260905',
  'BASEMENT 004', '을지로 지하, 새벽까지 이어지는 테크노',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=70',
  '을지로 언더그라운드', '을지로',
  '2026-09-05 22:00+09', '2026-09-06 05:00+09', 120, false, false,
  '{"테크노"}', '{"클럽"}', 35000, '신한 110-000-000000', 'open'
);

insert into ticket_tiers (event_id, name, note, price, capacity, sort_order) values
  ('00000000-0000-0000-0000-0000000000e2', '얼리버드', '선착순', 25000, 60, 0),
  ('00000000-0000-0000-0000-0000000000e2', '일반',     null,     35000, 60, 1);

-- 예매를 좀 넣어 둔다. 화면이 0 이면 게이지도 성비도 확인이 안 된다
do $seed$
declare
  v_tier uuid;
  i int;
begin
  select id into v_tier from ticket_tiers
  where event_id = '00000000-0000-0000-0000-0000000000e1' and sort_order = 0;

  for i in 1..18 loop
    insert into bookings (
      code, event_id, tier_id, name, phone, gender, quantity, amount,
      invite_code, status, paid_at, expires_at, created_at
    ) values (
      'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
      '00000000-0000-0000-0000-0000000000e1', v_tier,
      '테스트' || i, '010-0000-' || lpad(i::text, 4, '0'),
      case when i % 2 = 0 then 'F' else 'M' end,
      case when i % 5 = 0 then 2 else 1 end,
      case when i % 2 = 0 then 39000 else 49000 end
        * (case when i % 5 = 0 then 2 else 1 end),
      case when i % 3 = 0 then 'AROS' when i % 3 = 1 then 'LYNN' else null end,
      case when i % 4 = 0 then 'pending' else 'paid' end,
      case when i % 4 = 0 then null else now() end,
      now() + interval '24 hours',
      now() - (i || ' hours')::interval
    );
  end loop;
end $seed$;
