/**
 * 파티모아 심볼 — 열린 원(파티가 열리는 자리) + 바깥의 점 하나(들어가려는 사람).
 * **원이 닫혀 있지 않은 것이 핵심**이다. 1인 참여 환영을 형태로 말한다.
 * 좌표를 손대지 말 것 — 사양서 2절에서 온 값이다.
 */
const DOTS: [number, number][] = [
  [63.2, 63.25],
  [51.32, 72.66],
  [36.53, 71.19],
  [26.6, 59.63],
  [26.6, 40.37],
  [36.53, 28.81],
  [51.32, 27.34],
  [63.2, 36.75],
];

export function Symbol({
  size = 26,
  dark = false,
  className,
}: {
  size?: number;
  /** 어두운 배경에 올릴 때. 점은 흰색, 액센트는 노랑이 된다 */
  dark?: boolean;
  className?: string;
}) {
  const dot = dark ? "#FFFFFF" : "#16181D";
  const accent = dark ? "#FFE24D" : "#5B2BE8";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {DOTS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={8.2} fill={dot} />
      ))}
      <circle cx={85} cy={50} r={10.17} fill={accent} />
    </svg>
  );
}

export function Wordmark({
  size = 20,
  dark = false,
}: {
  size?: number;
  dark?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-extrabold tracking-[-0.03em]"
      style={{ fontSize: size }}
    >
      <Symbol size={size * 1.3} dark={dark} />
      <span className={dark ? "text-white" : "text-ink"}>파티</span>
      <span
        className="-ml-1.5"
        style={{ color: dark ? "#FFE24D" : "#5B2BE8" }}
      >
        모아
      </span>
    </span>
  );
}
