"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useNewParty } from "./NewPartyProvider";
import { signOut } from "@/lib/actions";

export function AppHeader({ canSignOut }: { canSignOut: boolean }) {
  const openNewParty = useNewParty();
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <header className="flex items-center justify-between gap-4 pt-[22px] pb-[18px]">
      <Link href="/" className="flex items-baseline gap-[9px] no-underline hover:no-underline">
        <span className="font-serif text-[30px] tracking-[-0.01em] text-ink">Accountly</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-subtle">ledger</span>
      </Link>

      <div className="flex items-center gap-1">
        {canSignOut ? (
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 rounded-full px-3 text-[13px] text-muted transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        ) : null}

        <button
          type="button"
          onClick={openNewParty}
          className="flex min-h-11 items-center gap-[7px] rounded-full bg-ink px-[17px] py-[11px] text-sm font-semibold text-canvas transition-colors hover:bg-accent"
        >
          <span className="text-[17px] leading-none">+</span>
          <span className="whitespace-nowrap">New party</span>
        </button>
      </div>
    </header>
  );
}
