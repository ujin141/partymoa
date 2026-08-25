import { Suspense } from "react";

import { CrewTabs } from "@/components/CrewTabs";
import { LogoutButton } from "@/components/LogoutButton";
import { Symbol } from "@/components/Symbol";
import { myCrew } from "@/lib/crew";

export default async function CrewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const crew = await myCrew();

  return (
    <div className="mx-auto flex h-dvh max-w-[430px] flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] sm:border-x sm:border-line">
      <header className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
        <Symbol size={22} />
        <span className="text-[17px] font-extrabold">
          파티<span className="text-brand">모아</span>
        </span>
        <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
          크루
        </span>
        {crew ? (
          <span className="ml-auto flex items-center gap-2.5">
            <span className="text-[13px] text-sub">{crew.name}</span>
            <LogoutButton
              to="/crew/login"
              className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-semibold text-sub"
            />
          </span>
        ) : null}
      </header>
      {children}
      {crew ? (
        <Suspense fallback={<div className="h-12 flex-none" />}>
          <CrewTabs />
        </Suspense>
      ) : null}
    </div>
  );
}
