-- 호스트가 명단에 손님을 직접 넣는다. Supabase SQL 편집기에 붙여 넣고 실행.
--
-- ## 왜 필요한가
--
-- DM·전화·현장으로 받는 예매가 계속 들어온다. 지금은 그때마다 SQL 파일을
-- 고쳐서 돌렸다 — 오늘만 세 번 했다. **행사 당일 입구에서 노트북을 열
-- 수는 없다.**
--
-- ## 손님이 하는 예매와 뭐가 다른가
--
-- create_booking 은 손님이 부른다. 그래서 정원·성비·차수를 넘으면 무조건
-- 막는다 — 막지 않으면 이중 판매가 난다.
--
-- 여기는 **크루가 부른다.** 크루는 이미 사정을 알고 넣는 사람이라, 막는
-- 대신 알려 주고 p_force 로 넘어갈 수 있게 한다. 대신 그냥 넘어가지는
-- 않는다 — 화면이 한 번 묻는다.
--
-- 금액도 크루가 정할 수 있다. 비우면 tier_price 가 계산한다.

create or replace function add_booking_manual(
  p_event_id uuid,
  p_name text,
  p_phone text,
  p_gender text,
  p_quantity int default 1,
  p_tier_id uuid default null,
  p_invite_code text default null,
  p_table_id uuid default null,
  p_amount int default null,
  p_paid boolean default true,
  p_force boolean default false
) returns bookings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_event  events;
  v_tier   ticket_tiers;
  v_booked int;
  v_booked_g int;
  v_gcap   int;
  v_invite text;
  v_known  boolean := false;
  v_amount int;
  v_row    bookings;
begin
  select * into v_event from events where id = p_event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- security definer 라 RLS 가 안 걸린다. 권한을 여기서 직접 본다
  if not is_event_staff(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'NEED_NAME_PHONE' using errcode = 'P0001';
  end if;
  if p_gender not in ('F', 'M') then
    raise exception 'BAD_GENDER' using errcode = 'P0001';
  end if;
  if p_quantity < 1 or p_quantity > 10 then
    raise exception 'BAD_QUANTITY' using errcode = 'P0001';
  end if;

  -- 차수를 안 주면 지금 열려 있는 것 중 마지막을 쓴다
  if p_tier_id is null then
    select * into v_tier from ticket_tiers
    where event_id = p_event_id and closed_at is null
    order by sort_order desc limit 1;
  else
    select * into v_tier from ticket_tiers
    where id = p_tier_id and event_id = p_event_id;
  end if;
  if not found then
    raise exception 'TIER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- **같은 이름 + 같은 번호가 이미 있으면 막는다.** 두 번 넣는 사고가
  -- 제일 잦고, 정원과 정산이 같이 어긋난다
  if exists (
    select 1 from bookings b
    where b.event_id = p_event_id
      and b.status <> 'cancelled'
      and b.name = trim(p_name)
      and regexp_replace(b.phone, '\D', '', 'g')
          = regexp_replace(p_phone, '\D', '', 'g')
  ) then
    raise exception 'DUPLICATE' using errcode = 'P0001';
  end if;

  -- 정원·성비는 **알려만 주고 막지 않는다** (p_force 로 넘어간다)
  if not p_force then
    select
      coalesce(sum(quantity) filter (where status <> 'cancelled'), 0),
      coalesce(sum(quantity) filter (where status <> 'cancelled'
                                       and gender = p_gender), 0)
    into v_booked, v_booked_g
    from bookings where event_id = p_event_id;

    if v_booked + p_quantity > v_event.capacity then
      raise exception 'OVER_CAPACITY:%', v_event.capacity - v_booked
        using errcode = 'P0001';
    end if;
    if v_event.gender_balanced then
      v_gcap := floor(v_event.capacity / 2.0);
      if v_booked_g + p_quantity > v_gcap then
        raise exception 'OVER_GENDER:%', v_gcap - v_booked_g
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- 추천인. 없는 코드는 적힌 대로 남기되 게스트가는 안 준다
  v_invite := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  if v_invite is not null then
    select exists (
      select 1 from crew_members
      where crew_id = v_event.crew_id and invite_code = v_invite
    ) into v_known;
  end if;

  v_amount := coalesce(p_amount,
                       tier_price(v_tier, v_event, p_gender, v_known)
                       * p_quantity);

  insert into bookings (
    code, event_id, tier_id, user_id, name, phone, gender,
    quantity, amount, invite_code, table_id, status, paid_at, expires_at
  ) values (
    'PM' || lpad(nextval('booking_code_seq')::text, 4, '0'),
    p_event_id, v_tier.id, null, trim(p_name), trim(p_phone), p_gender,
    p_quantity, v_amount, v_invite, p_table_id,
    case when p_paid then 'paid' else 'pending' end,
    case when p_paid then now() else null end,
    -- 입금이 끝난 건은 풀릴 일이 없다. 그래도 칼럼이 비면 안 되니
    -- 행사 뒤로 밀어 둔다
    case when p_paid then now() + interval '365 days'
         else now() + interval '24 hours' end
  ) returning * into v_row;

  return v_row;
end $fn$;

revoke all on function add_booking_manual from public, anon;
grant execute on function add_booking_manual to authenticated;
