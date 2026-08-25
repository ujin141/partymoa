/**
 * 뼈대. **회색 덩어리를 아무 데나 깔지 않고 실제 카드 모양을 흉내 낸다** —
 * 모양이 다르면 내용이 들어오는 순간 화면이 튄다.
 */
export function Bar({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return (
    <div
      className="animate-pulse rounded-md bg-soft"
      style={{ width: w, height: h }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="px-4 pb-5">
      <div className="aspect-5/3 animate-pulse rounded-card bg-soft" />
      <div className="mt-3 grid gap-2">
        <Bar w="68%" h={17} />
        <Bar w="52%" h={13} />
        <Bar w="40%" h={19} />
      </div>
    </div>
  );
}

export function ListSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="pt-4">
      {Array.from({ length: n }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
