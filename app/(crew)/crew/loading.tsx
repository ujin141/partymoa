export default function Loading() {
  return (
    <div className="flex-1 px-4 pt-5">
      <div className="h-[22px] w-40 animate-pulse rounded-md bg-soft" />
      <div className="mt-3 h-2 animate-pulse rounded-full bg-soft" />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="h-[76px] animate-pulse rounded-xl bg-soft" />
        <div className="h-[76px] animate-pulse rounded-xl bg-soft" />
      </div>
      <div className="mt-5 grid gap-2.5">
        <div className="h-[52px] animate-pulse rounded-xl bg-soft" />
        <div className="h-[52px] animate-pulse rounded-xl bg-soft" />
        <div className="h-[52px] animate-pulse rounded-xl bg-soft" />
      </div>
    </div>
  );
}
