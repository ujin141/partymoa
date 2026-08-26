/**
 * 사양서 5절 스키마를 손으로 옮긴 것. 마이그레이션을 고치면 여기도 고친다.
 * 나중에 `pnpm gen:types` 로 실제 DB 에서 다시 뽑는다.
 *
 * supabase-js 는 Row/Insert/Update/Relationships 네 개가 다 있어야 제네릭을
 * 풀어낸다. 하나라도 빠지면 insert 인자 타입이 never 로 무너진다.
 */

export type BookingStatus = "pending" | "paid" | "checked_in" | "cancelled";
export type EventStatus = "draft" | "open" | "closed" | "done";
export type Gender = "F" | "M";

export type Crew = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  instagram: string | null;
  /** 대표 계정. 아직 가입 전이면 null 이고 crew_members.email 로 권한이 간다 */
  owner_id: string | null;
  created_at: string;
}

export type CrewMember = {
  id: string;
  crew_id: string;
  user_id: string | null;
  display_name: string;
  invite_code: string;
  role: "owner" | "member";
  /** 적어 두면 그 주소로 소셜 로그인한 사람이 바로 스태프가 된다 */
  email: string | null;
  created_at: string;
}

export type CrewApplicationStatus = "pending" | "approved" | "rejected";

export type CrewApplication = {
  id: string;
  crew_name: string;
  slug: string;
  instagram: string | null;
  bio: string | null;
  contact_name: string;
  contact_phone: string;
  email: string;
  venue: string | null;
  scale: string | null;
  history: string | null;
  note: string | null;
  user_id: string | null;
  status: CrewApplicationStatus;
  reject_reason: string | null;
  reviewed_at: string | null;
  crew_id: string | null;
  created_at: string;
}

export type Profile = {
  user_id: string;
  nickname: string | null;
  real_name: string | null;
  phone: string | null;
  /** 취향. 비어 있으면 전체를 보여 준다 */
  areas: string[];
  categories: string[];
  /** 시작 화면을 본 시각. 취향을 안 골라도 다시 안 띄운다 */
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Review = {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  body: string;
  nickname: string;
  deleted_at: string | null;
  created_at: string;
}

export type ReviewStats = {
  event_id: string;
  reviews: number;
  rating: number;
}

export type EventTable = {
  id: string;
  event_id: string;
  name: string;
  /** 계좌이체 기준 */
  price: number;
  /** 카드 결제가. 비우면 안 띄운다 */
  card_price: number | null;
  /** 몇 명까지 앉나. 입장비가 없는 인원이 이 숫자다 */
  seats: number;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export type EventPhoto = {
  id: string;
  event_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export type PushSubscription = {
  endpoint: string;
  user_id: string | null;
  p256dh: string;
  auth: string;
  failed_at: string | null;
  created_at: string;
}

export type PushLog = {
  booking_id: string;
  kind: "expiring" | "today" | "paid";
  sent_at: string;
}

export type EventRow = {
  id: string;
  crew_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  venue_name: string;
  area: string;
  address: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  gender_balanced: boolean;
  male_price_multiplier: number;
  solo_friendly: boolean;
  /**
   * 필터로만 쓰는 값들. **전부 비워 둘 수 있다.**
   * 안 적은 파티가 목록에서 사라지면 그건 크루에게 벌을 주는 것이다.
   */
  couple_friendly: boolean;
  age_min: number | null;
  age_max: number | null;
  /** 'korean' 한국인 위주 · 'mixed' 반반 · 'global' 외국인 많음 */
  crowd: "korean" | "mixed" | "global" | null;
  genres: string[];
  categories: string[];
  list_price: number;
  bank_account: string | null;
  /** 유효한 초대 코드를 넣었을 때의 금액. 비우면 할인 없음 */
  guest_price: number | null;
  /** 테이블 전체에 붙는 공통 안내 */
  tables_note: string | null;
  status: EventStatus;
  created_at: string;
}

export type TicketTier = {
  id: string;
  event_id: string;
  name: string;
  note: string | null;
  price: number;
  /** 남성가. null 이면 events.male_price_multiplier 로 계산한다 */
  male_price: number | null;
  capacity: number;
  /**
   * 마감한 차수. **자리가 남아 있어도 안 판다.**
   *
   * 정원으로만 판단하면, 이미 끝난 차수에서 한 건이 취소되는 순간
   * 그 차수가 다시 열리고 화면의 가격이 옛 가격으로 되돌아간다.
   * 실제로 그 일이 났다 — 2차가 끝났는데 홈에 49,000원이 떴다.
   */
  closed_at: string | null;
  sort_order: number;
}

/** 아직 처리 안 한 신고. 운영 화면이 이걸 본다 */
export type OpenReport = {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  reason: string;
  created_at: string;
  author: string | null;
  body: string | null;
  post_id: string | null;
};

export type Lineup = {
  id: string;
  event_id: string;
  artist_name: string;
  starts_at: string;
  sort_order: number;
}

export type Booking = {
  id: string;
  code: string;
  event_id: string;
  tier_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  gender: Gender;
  quantity: number;
  amount: number;
  invite_code: string | null;
  /** 앉는 테이블. **표시용이고 금액은 안 담는다** — 한 테이블에 여럿이 앉는다 */
  table_id: string | null;
  status: BookingStatus;
  paid_at: string | null;
  checked_in_at: string | null;
  expires_at: string;
  created_at: string;
}

export type EventExpense = {
  id: string;
  event_id: string;
  label: string;
  amount: number;
  /** expense = 정산에서 뺀다 · income = 더한다(수수료 안 붙음) */
  kind: "expense" | "income";
  sort_order: number;
  created_at: string;
}

/** 파생값은 저장하지 않는다 — 뷰에서 집계한다 (사양서 5절) */
export type EventStats = {
  event_id: string;
  capacity: number;
  booked: number;
  booked_f: number;
  booked_m: number;
  revenue_paid: number;
  revenue_total: number;
}

export type TierStats = {
  tier_id: string;
  event_id: string;
  capacity: number;
  sold: number;
}

export type Post = {
  id: string;
  user_id: string | null;
  nickname: string;
  body: string;
  event_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string | null;
  nickname: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

/** 목록용 — 댓글 수와 연결된 파티 제목이 붙어 온다 */
export type PostListRow = {
  id: string;
  user_id: string | null;
  nickname: string;
  body: string;
  event_id: string | null;
  created_at: string;
  comment_count: number;
  event_title: string | null;
  event_slug: string | null;
};

/** create_booking 이 막았을 때 돌려주는 코드 */
export type BookingErrorCode =
  | "EVENT_NOT_OPEN"
  | "TIER_NOT_FOUND"
  | "TIER_SOLD_OUT"
  | "CAPACITY_EXCEEDED"
  | "GENDER_CAPACITY_EXCEEDED";

type Table<Row, Ins = Partial<Row>, Upd = Partial<Row>> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

/**
 * insert 에 꼭 있어야 하는 칼럼만 필수로 두고 나머지는 선택.
 * 전부 필수로 두면 null 을 허용하는 칼럼까지 매번 적어야 해서, 안 적으면
 * 컴파일이 막히고 적으면 코드가 지저분해진다.
 */
type Insertable<T, Req extends keyof T> = Pick<T, Req> & Partial<T>;

export type Database = {
  public: {
    Tables: {
      crews: Table<Crew, Insertable<Crew, "name" | "slug">>;
      profiles: Table<Profile, Insertable<Profile, "user_id">>;
      push_subscriptions: Table<
        PushSubscription,
        Insertable<PushSubscription, "endpoint" | "p256dh" | "auth">
      >;
      push_log: Table<PushLog, Insertable<PushLog, "booking_id" | "kind">>;
      event_photos: Table<
        EventPhoto,
        Insertable<EventPhoto, "event_id" | "url">
      >;
      event_tables: Table<
        EventTable,
        Insertable<EventTable, "event_id" | "name" | "price" | "seats">
      >;
      reviews: Table<
        Review,
        Insertable<Review, "event_id" | "user_id" | "rating" | "body" | "nickname">
      >;
      crew_applications: Table<
        CrewApplication,
        Insertable<
          CrewApplication,
          "crew_name" | "slug" | "contact_name" | "contact_phone" | "email"
        >
      >;
      crew_members: Table<
        CrewMember,
        Insertable<CrewMember, "crew_id" | "display_name" | "invite_code">
      >;
      events: Table<
        EventRow,
        Insertable<
          EventRow,
          "crew_id" | "slug" | "title" | "venue_name" | "area" |
            "starts_at" | "ends_at" | "capacity" | "list_price"
        >
      >;
      ticket_tiers: Table<
        TicketTier,
        Insertable<TicketTier, "event_id" | "name" | "price" | "capacity" | "sort_order">
      >;
      lineups: Table<
        Lineup,
        Insertable<Lineup, "event_id" | "artist_name" | "starts_at" | "sort_order">
      >;
      bookings: Table<Booking, Insertable<Booking, "event_id" | "tier_id">>;
      event_expenses: Table<
        EventExpense,
        Insertable<EventExpense, "event_id" | "label" | "amount">
      >;
      favorites: Table<{
        user_id: string;
        event_id: string;
        created_at: string;
      }>;
      admin_emails: Table<
        { email: string; note: string | null; created_at: string },
        { email: string; note?: string | null }
      >;
      app_admins: Table<
        { user_id: string; note: string | null; created_at: string },
        { user_id: string; note?: string | null }
      >;
      posts: Table<Post, Insertable<Post, "nickname" | "body">>;
      post_comments: Table<
        PostComment,
        Insertable<PostComment, "post_id" | "nickname" | "body">
      >;
      crew_follows: Table<{
        user_id: string;
        crew_id: string;
        created_at: string;
      }>;
    };
    Views: {
      event_stats: View<EventStats>;
      tier_stats: View<TierStats>;
      post_list: View<PostListRow>;
      open_reports: View<OpenReport>;
      review_stats: View<ReviewStats>;
      platform_stats: View<{
        event_id: string;
        crew_id: string;
        title: string;
        starts_at: string;
        status: EventStatus;
        crew_name: string;
        capacity: number;
        booked: number;
        revenue_paid: number;
        fee: number;
      }>;
    };
    Functions: {
      create_booking: {
        Args: {
          p_event_id: string;
          p_tier_id: string;
          p_name: string;
          p_phone: string;
          p_gender: string;
          p_quantity: number;
          p_invite_code: string | null;
        };
        Returns: Booking;
      };
      expire_unpaid_bookings: {
        Args: Record<string, never>;
        Returns: number;
      };
      find_booking: {
        Args: { p_code: string; p_phone: string };
        Returns: Booking;
      };
      claim_booking: {
        Args: { p_code: string; p_phone: string };
        Returns: Booking;
      };
      create_post: {
        Args: { p_nickname: string; p_body: string; p_event_id: string | null };
        Returns: Post;
      };
      create_comment: {
        Args: { p_post_id: string; p_nickname: string; p_body: string };
        Returns: PostComment;
      };
      find_user_id: { Args: { p_email: string }; Returns: string | null };
      delete_post: { Args: { p_id: string }; Returns: undefined };
      delete_comment: { Args: { p_id: string }; Returns: undefined };
      can_review: { Args: { p_event: string }; Returns: boolean };
      find_bookings_by_phone: {
        Args: { p_phone: string; p_name: string };
        Returns: Booking[];
      };
      claim_bookings_by_phone: {
        Args: { p_phone: string; p_name: string };
        Returns: Booking[];
      };
      preference_stats: {
        Args: Record<string, never>;
        Returns: { kind: string; value: string; people: number }[];
      };
      preference_summary: {
        Args: Record<string, never>;
        Returns: { people: number; onboarded: number; picked: number }[];
      };
      member_list: {
        Args: { p_q?: string | null };
        Returns: {
          user_id: string;
          email: string | null;
          provider: string;
          is_anonymous: boolean;
          joined_at: string;
          last_seen_at: string | null;
          nickname: string | null;
          real_name: string | null;
          phone: string | null;
          areas: string[];
          categories: string[];
          bookings: number;
          paid: number;
        }[];
      };
      rate_ok: {
        Args: { p_bucket: string; p_limit: number; p_seconds: number };
        Returns: boolean;
      };
      promote_anonymous: { Args: Record<string, never>; Returns: boolean };
      report_content: {
        Args: { p_type: string; p_id: string; p_reason: string };
        Returns: boolean;
      };
      block_author: {
        Args: { p_type: string; p_id: string };
        Returns: boolean;
      };
      unblock_all: { Args: Record<string, never>; Returns: number };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: { deleted: boolean; kept_bookings: number };
      };
      cancel_my_booking: { Args: { p_booking: string }; Returns: Booking };
      check_invite: {
        Args: { p_event: string; p_code: string };
        Returns: { valid: boolean; price: number | null }[];
      };
      set_booking_invite: {
        Args: { p_booking: string; p_code: string | null };
        Returns: Booking;
      };
      push_targets: {
        Args: Record<string, never>;
        Returns: {
          booking_id: string;
          kind: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          title: string;
          body: string;
          url: string;
        }[];
      };
      member_summary: {
        Args: Record<string, never>;
        Returns: {
          people: number;
          anonymous: number;
          google: number;
          with_profile: number;
          buyers: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
