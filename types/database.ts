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
  genres: string[];
  categories: string[];
  list_price: number;
  bank_account: string | null;
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
  sort_order: number;
}

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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
