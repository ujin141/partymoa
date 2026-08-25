import Link from "next/link";

import { PartyCard } from "@/components/PartyCard";
import { Empty } from "@/components/ui/primitives";
import { listFavorites } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "찜한 파티" };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const list = user ? await listFavorites() : [];

  return (
    <>
      <header className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <Link href="/my" className="text-2xl leading-none" aria-label="뒤로">
          ‹
        </Link>
        <span className="text-[17px] font-extrabold">찜한 파티</span>
        <span className="ml-auto text-[13px] text-sub">{list.length}개</span>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain pt-4">
        {!user ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm leading-8 text-sub">
              찜은 계정에 저장돼요.
              <br />
              로그인하면 기기를 바꿔도 남아 있습니다.
            </p>
            <Link
              href="/login?next=/my/favorites"
              className="mt-5 inline-block rounded-xl bg-brand px-6 py-3.5 text-[15px] font-bold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : list.length === 0 ? (
          <Empty>
            아직 찜한 파티가 없어요.
            <br />
            카드의 하트를 눌러 담아 두세요.
          </Empty>
        ) : (
          list.map((d) => <PartyCard key={d.event.id} d={d} />)
        )}
        <div className="h-4" />
      </div>
    </>
  );
}
