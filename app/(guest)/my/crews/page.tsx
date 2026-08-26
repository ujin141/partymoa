import Image from "next/image";
import Link from "next/link";

import { Empty } from "@/components/ui/primitives";
import { listCrews } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "호스트" };

export default async function CrewsPage() {
  const crews = await listCrews();

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">호스트</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {crews.length === 0 ? (
          <Empty>아직 등록된 호스트가 없어요.</Empty>
        ) : (
          crews.map((c) => (
            <Link
              key={c.id}
              href={`/explore?crew=${c.slug}`}
              className="flex items-center gap-3.5 border-b border-line px-4 py-3.5 transition active:bg-soft"
            >
              <div className="h-12 w-12 flex-none overflow-hidden rounded-full bg-soft">
                {c.avatar_url ? (
                  <Image
                    src={c.avatar_url}
                    alt=""
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-brand-soft text-[13px] font-extrabold text-brand">
                    {c.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[15.5px] font-bold">
                  {c.name}
                </b>
                {c.bio ? (
                  <p className="mt-0.5 truncate text-[13px] text-sub">
                    {c.bio}
                  </p>
                ) : null}
              </div>
              <span className="text-[19px] text-[#C0C4CC]">›</span>
            </Link>
          ))
        )}
        <p className="px-4 py-5 text-[12.5px] leading-relaxed text-sub">
          팔로우 기능은 준비 중이에요. 지금은 호스트를 누르면 그 호스트의 파티만
          모아 봅니다.
        </p>
      </div>
    </>
  );
}
