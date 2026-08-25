import { NewCrewForm } from "@/components/admin/NewCrewForm";
import { allCrews, platformRows, rollup } from "@/lib/admin";
import { won } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "크루 관리" };

export default async function AdminCrewsPage() {
  const [rows, crews] = await Promise.all([platformRows(), allCrews()]);
  const list = rollup(crews, rows);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="flex flex-wrap items-center gap-3 px-4 pb-4 pt-5">
        <div>
          <h1 className="text-[21px] font-extrabold">크루</h1>
          <p className="mt-1 text-[13px] text-sub">{crews.length}팀</p>
        </div>
        <div className="ml-auto w-full sm:ml-auto sm:w-auto">
          <NewCrewForm />
        </div>
      </div>

      {list.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-sub">
          아직 등록된 크루가 없어요.
        </p>
      ) : (
        list.map((c) => (
          <div
            key={c.crew.id}
            id={c.crew.slug}
            className="border-b border-line px-4 py-4"
          >
            <div className="flex items-center gap-2">
              <b className="text-[16px] font-extrabold">{c.crew.name}</b>
              <span className="rounded bg-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-sub">
                {c.crew.slug}
              </span>
              {c.crew.instagram ? (
                <a
                  href={`https://instagram.com/${c.crew.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] text-brand underline"
                >
                  @{c.crew.instagram}
                </a>
              ) : null}
            </div>
            {c.crew.bio ? (
              <p className="mt-1 text-[13px] text-sub">{c.crew.bio}</p>
            ) : null}
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-soft px-3 py-2">
                <small className="text-[12px] text-sub">파티</small>
                <b className="block text-[15px] font-extrabold">
                  {c.events}개
                </b>
              </div>
              <div className="rounded-lg bg-soft px-3 py-2">
                <small className="text-[12px] text-sub">예매</small>
                <b className="block text-[15px] font-extrabold">{c.booked}명</b>
              </div>
              <div className="rounded-lg bg-soft px-3 py-2">
                <small className="text-[12px] text-sub">확정 매출</small>
                <b className="block text-[15px] font-extrabold">
                  {won(c.revenue)}
                </b>
              </div>
              <div className="rounded-lg bg-brand-soft px-3 py-2">
                <small className="text-[12px] text-brand">수수료</small>
                <b className="block text-[15px] font-extrabold text-brand">
                  {won(c.fee)}
                </b>
              </div>
            </div>
          </div>
        ))
      )}
      <div className="h-8" />
    </div>
  );
}
