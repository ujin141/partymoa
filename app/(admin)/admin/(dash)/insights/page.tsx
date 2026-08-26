import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "취향", robots: { index: false } };

type Row = { kind: string; value: string; people: number };
type Sum = { people: number; onboarded: number; picked: number };

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-soft px-4 py-3">
      <small className="text-[12.5px] text-sub">{label}</small>
      <b className="mt-0.5 block text-[21px] font-extrabold">{value}</b>
      {note ? <div className="mt-0.5 text-[12px] text-sub">{note}</div> : null}
    </div>
  );
}

function Bars({ rows, top }: { rows: Row[]; top: number }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-[13.5px] text-sub">
        아직 고른 사람이 없어요.
      </p>
    );
  }
  return (
    <div className="pb-2">
      {rows.map((r) => (
        <div key={r.value} className="flex items-center gap-3 py-1.5">
          <span className="w-[68px] flex-none text-[13.5px] font-semibold">
            {r.value}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-soft">
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${Math.max(4, (r.people / top) * 100)}%` }}
            />
          </span>
          <span className="w-[42px] flex-none text-right text-[13px] font-bold">
            {`${r.people}명`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 시작 화면에서 고른 취향.
 *
 * **개인은 안 보인다.** 프로필에는 이름·연락처가 같이 있어서 표를 통째로
 * 열 수 없다. DB 의 preference_stats() 가 합계만 내주고, 그 안에서
 * 운영자인지 다시 확인한다.
 *
 * 이 화면은 "다음에 뭘 밀지" 를 정하는 데 쓴다 — 사람이 몰린 지역과
 * 분위기가 곧 다음 파티를 어디서 어떻게 열지의 근거다.
 */
export default async function AdminInsightsPage() {
  const supabase = await createClient();
  const [{ data: statRows, error }, { data: sumRows }] = await Promise.all([
    supabase.rpc("preference_stats"),
    supabase.rpc("preference_summary"),
  ]);

  const rows = (statRows ?? []) as Row[];
  const sum = ((sumRows ?? [])[0] ?? null) as Sum | null;

  const areas = rows.filter((r) => r.kind === "지역");
  const cats = rows.filter((r) => r.kind === "분위기");
  const top = Math.max(1, ...rows.map((r) => r.people));

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-4 pt-5">
        <h1 className="text-[21px] font-extrabold">취향</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-sub">
          시작 화면에서 고른 지역·분위기입니다. 누가 골랐는지는 보이지 않고
          합계만 나옵니다.
        </p>
      </div>

      {error ? (
        <p className="mx-4 rounded-xl bg-[#FDECEF] px-4 py-3.5 text-[13.5px] leading-relaxed text-hot">
          집계를 읽지 못했어요. APPLY.sql 을 아직 안 돌렸다면 그것부터
          돌려 주세요.
        </p>
      ) : null}

      {sum ? (
        <div className="grid grid-cols-3 gap-2.5 px-4">
          <Kpi label="가입" value={`${sum.people}명`} />
          <Kpi
            label="시작 화면 완료"
            value={`${sum.onboarded}명`}
            note={
              sum.people
                ? `${Math.round((sum.onboarded / sum.people) * 100)}%`
                : undefined
            }
          />
          <Kpi
            label="취향 고름"
            value={`${sum.picked}명`}
            note={
              sum.onboarded
                ? `완료자의 ${Math.round((sum.picked / sum.onboarded) * 100)}%`
                : undefined
            }
          />
        </div>
      ) : null}

      <div className="px-4 pb-1 pt-7">
        <h2 className="text-[17px] font-extrabold">지역</h2>
      </div>
      <div className="px-4">
        <Bars rows={areas} top={top} />
      </div>

      <div className="px-4 pb-1 pt-6">
        <h2 className="text-[17px] font-extrabold">분위기</h2>
      </div>
      <div className="px-4">
        <Bars rows={cats} top={top} />
      </div>

      <p className="px-4 py-6 text-[12.5px] leading-relaxed text-sub">
        로그인하지 않고 고른 사람은 여기 안 잡힙니다. 브라우저에만 남아
        있어서 계정이 없으면 셀 방법이 없어요.
      </p>
    </div>
  );
}
