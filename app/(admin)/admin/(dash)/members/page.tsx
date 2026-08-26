import { stamp, won } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "가입자", robots: { index: false } };

type Row = {
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
};

type Sum = {
  people: number;
  anonymous: number;
  google: number;
  with_profile: number;
  buyers: number;
};

const PROVIDER: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  apple: "애플",
  email: "이메일",
};

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-soft px-4 py-3">
      <small className="text-[12.5px] text-sub">{label}</small>
      <b className="mt-0.5 block text-[21px] font-extrabold">{value}</b>
      {note ? <div className="mt-0.5 text-[12px] text-sub">{note}</div> : null}
    </div>
  );
}

/**
 * 가입자 목록 (운영자 전용).
 *
 * **익명 세션은 기본으로 감춘다.** 로그인 없이 예매하면 계정이 하나
 * 생기는데, 그게 목록의 대부분을 채우면 진짜 회원이 안 보인다.
 * 숫자로는 위에 따로 세어 둔다.
 *
 * 검색은 서버가 한다. 오백 명이 넘어가면 화면에서 거르는 게 더 느리고,
 * 무엇보다 전체를 클라이언트로 내려보내면 연락처가 통째로 나간다.
 */
export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; anon?: string }>;
}) {
  const { q, anon } = await searchParams;
  const supabase = await createClient();

  const [{ data: rowData, error }, { data: sumData }] = await Promise.all([
    supabase.rpc("member_list", { p_q: q ?? null }),
    supabase.rpc("member_summary"),
  ]);

  const all = (rowData ?? []) as Row[];
  const sum = ((sumData ?? [])[0] ?? null) as Sum | null;
  const showAnon = anon === "1";
  const rows = showAnon ? all : all.filter((r) => !r.is_anonymous);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-4 pt-5">
        <h1 className="text-[21px] font-extrabold">가입자</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-sub">
          로그인 계정과 프로필입니다. 최근 가입 순 500명까지 보여 줍니다.
        </p>
      </div>

      {/* **이유를 그대로 보여 준다.** "못 읽었어요" 만 띄워 두면 함수가
          없는 건지, 권한이 없는 건지, SQL 이 터진 건지 알 수가 없다 */}
      {error ? (
        <div className="mx-4 rounded-xl bg-[#FDECEF] px-4 py-3.5 text-[13.5px] leading-relaxed text-hot">
          <b className="block">목록을 읽지 못했어요.</b>
          {error.message}
          <span className="mt-1.5 block text-[12.5px]">
            함수가 없다고 나오면 APPLY.sql 을 돌리세요.
          </span>
        </div>
      ) : null}

      {sum ? (
        <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-5">
          <Kpi label="회원" value={`${sum.people}명`} />
          <Kpi label="구글" value={`${sum.google}명`} />
          <Kpi
            label="프로필 작성"
            value={`${sum.with_profile}명`}
            note={
              sum.people
                ? `${Math.round((sum.with_profile / sum.people) * 100)}%`
                : undefined
            }
          />
          <Kpi label="예매한 사람" value={`${sum.buyers}명`} />
          <Kpi
            label="익명 세션"
            value={`${sum.anonymous}개`}
            note="로그인 없이 둘러본 기기"
          />
        </div>
      ) : null}

      <form className="flex gap-2 px-4 pb-3 pt-5">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="이메일, 닉네임, 이름, 연락처 검색"
          className="min-w-0 flex-1 rounded-xl bg-soft px-3.5 py-2.5 text-[14px] outline-none"
        />
        {showAnon ? <input type="hidden" name="anon" value="1" /> : null}
        <button
          type="submit"
          className="flex-none rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-bold text-white"
        >
          검색
        </button>
      </form>

      <div className="flex items-center gap-3 px-4 pb-3">
        <span className="text-[13px] text-sub">{`${rows.length}명`}</span>
        <a
          href={
            showAnon
              ? `/admin/members${q ? `?q=${encodeURIComponent(q)}` : ""}`
              : `/admin/members?anon=1${q ? `&q=${encodeURIComponent(q)}` : ""}`
          }
          className="text-[13px] text-brand underline"
        >
          {showAnon ? "익명 세션 감추기" : "익명 세션도 보기"}
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-sub">
          조건에 맞는 가입자가 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto px-4">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12.5px] text-sub">
                <th className="py-2 font-medium">닉네임</th>
                <th className="py-2 font-medium">이메일</th>
                <th className="py-2 font-medium">로그인</th>
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">연락처</th>
                <th className="py-2 font-medium">취향</th>
                <th className="py-2 text-right font-medium">예매</th>
                <th className="py-2 text-right font-medium">결제액</th>
                <th className="py-2 font-medium">가입</th>
                <th className="py-2 font-medium">최근 접속</th>
                <th className="py-2 font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-line align-top">
                  <td className="py-2.5 font-bold">
                    {r.nickname ?? (r.is_anonymous ? "—" : "(없음)")}
                  </td>
                  <td className="max-w-[190px] truncate py-2.5 text-sub">
                    {r.email ?? "—"}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                        r.is_anonymous
                          ? "bg-soft text-sub"
                          : "bg-brand-soft text-brand"
                      }`}
                    >
                      {r.is_anonymous
                        ? "익명"
                        : (PROVIDER[r.provider] ?? r.provider)}
                    </span>
                  </td>
                  <td className="py-2.5">{r.real_name ?? "—"}</td>
                  <td className="py-2.5 text-sub">{r.phone ?? "—"}</td>
                  <td className="max-w-[180px] py-2.5 text-sub">
                    {[...r.areas, ...r.categories].join(" · ") || "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {r.bookings ? `${r.bookings}건` : "—"}
                  </td>
                  <td className="py-2.5 text-right font-semibold">
                    {r.paid ? won(Number(r.paid)) : "—"}
                  </td>
                  <td className="py-2.5 text-sub">{stamp(r.joined_at)}</td>
                  <td className="py-2.5 text-sub">
                    {r.last_seen_at ? stamp(r.last_seen_at) : "—"}
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-[#B4B8C2]">
                    {r.user_id.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-4 py-6 text-[12.5px] leading-relaxed text-sub">
        이름·연락처는 손님이 직접 적은 값입니다. 예매 대조와 문의 처리 외에
        쓰지 않습니다.
      </p>
    </div>
  );
}
