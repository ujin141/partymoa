import type { ReactNode } from "react";

/** 정원 게이지. 상세와 관리자 현황이 같은 걸 쓴다 */
export function Gauge({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "hot" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-soft">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          tone === "hot" ? "bg-hot" : "bg-brand"
        }`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Tag({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "solo";
}) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        tone === "solo"
          ? "bg-brand-soft text-brand"
          : "bg-soft text-sub"
      }`}
    >
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "hot";
}) {
  return (
    <span
      className={`absolute left-2.5 top-2.5 rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-bold text-white backdrop-blur-sm ${
        tone === "hot" ? "bg-hot" : "bg-ink/80"
      }`}
    >
      {children}
    </span>
  );
}

/** 섹션 제목 + 부제. **왜 모았는지 부제로 말한다** (사양서 4-1) */
export function SectionTitle({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between px-4 pb-3 pt-6">
      <div>
        <h2 className="text-[19px] font-extrabold">{title}</h2>
        {note ? <p className="mt-1 text-[13px] text-sub">{note}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Divider() {
  return <div className="mt-2 h-2 bg-soft" />;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-20 text-center text-sm leading-8 text-sub">
      {children}
    </div>
  );
}

const STATUS_STYLE = {
  pending: "bg-[#FFF4E5] text-[#B76E00]",
  paid: "bg-[#E7F7EF] text-ok",
  checked_in: "bg-brand-soft text-brand",
  cancelled: "bg-soft text-sub",
} as const;

const STATUS_LABEL = {
  pending: "입금 대기",
  paid: "입금 완료",
  checked_in: "입장 완료",
  cancelled: "취소됨",
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS_LABEL }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-1 text-[11.5px] font-bold ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
