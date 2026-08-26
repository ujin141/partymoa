import { MarketingSender } from "@/components/admin/MarketingSender";
import { requireAdmin } from "@/lib/admin";
import { nightNow } from "@/lib/night";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "광고 알림" };

export default async function AdminPushPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  let consented = 0;
  let devices = 0;
  let log: {
    id: string;
    title: string;
    targets: number;
    sent: number;
    created_at: string;
  }[] = [];

  if (supabase) {
    const [{ count }, { data: targets }, { data: rows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("marketing_push", true),
      supabase.rpc("marketing_targets"),
      supabase
        .from("marketing_log")
        .select("id, title, targets, sent, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    consented = count ?? 0;
    devices = (targets ?? []).length;
    log = (rows ?? []) as typeof log;
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-[21px] font-extrabold">광고 알림</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-sub">
        <b className="text-ink">따로 동의한 사람에게만</b> 갑니다. 예매 알림
        (입금 확인·마감 임박·당일 안내)은 이것과 무관하게 계속 갑니다.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-soft px-3.5 py-3">
          <small className="text-[12.5px] text-sub">광고 동의</small>
          <b className="mt-0.5 block text-[19px] font-extrabold">
            {consented}명
          </b>
        </div>
        <div className="rounded-xl bg-soft px-3.5 py-3">
          <small className="text-[12.5px] text-sub">받을 기기</small>
          <b className="mt-0.5 block text-[19px] font-extrabold">
            {devices}대
          </b>
          <div className="mt-0.5 text-[12px] text-sub">한 사람이 여럿일 수 있어요</div>
        </div>
      </div>

      {!supabase ? (
        <p className="mt-4 rounded-xl bg-[#FFF4E5] p-3.5 text-[13px] leading-relaxed text-[#B76E00]">
          SUPABASE_SERVICE_ROLE_KEY 가 없어서 대상을 못 셉니다. 배포
          환경변수에 넣어 주세요.
        </p>
      ) : null}

      <MarketingSender night={nightNow()} devices={devices} />

      <h2 className="mb-2 mt-8 text-base font-extrabold">보낸 기록</h2>
      {log.length === 0 ? (
        <p className="py-4 text-[13px] text-sub">아직 보낸 광고가 없어요.</p>
      ) : (
        log.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-3 border-b border-line py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-bold">{l.title}</div>
              <div className="mt-0.5 text-[12.5px] text-sub">
                {new Date(l.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
            <span className="flex-none text-[13px] font-semibold text-sub">
              {l.sent}/{l.targets}
            </span>
          </div>
        ))
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-sub">
        보낸 기록은 지우지 않습니다. 수신거부 분쟁이 생기면 언제 무엇을
        누구에게 보냈는지가 근거가 됩니다.
      </p>
    </div>
  );
}
