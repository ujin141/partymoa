import { ListSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <header className="flex flex-none items-center border-b border-line px-4 py-3.5">
        <div className="h-[22px] w-24 animate-pulse rounded-md bg-soft" />
      </header>
      <div className="flex-1 overflow-hidden">
        <div className="mx-4 mt-3.5 h-[46px] animate-pulse rounded-xl bg-soft" />
        <ListSkeleton n={3} />
      </div>
    </>
  );
}
