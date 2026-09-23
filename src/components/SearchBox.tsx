"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Search lives in the URL so a filtered list is shareable and survives a
 * reload. Typing is debounced so each keystroke does not hit the database.
 */
export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [, startTransition] = useTransition();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");

      startTransition(() => {
        router.replace(next.size ? `/?${next}` : "/", { scroll: false });
      });
    }, 220);

    return () => clearTimeout(timer);
    // `params` is intentionally excluded: reacting to it would re-fire the
    // effect with the value we just pushed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, router]);

  return (
    <div className="relative mb-[18px]">
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search a name or phone"
        aria-label="Search parties by name or phone"
        className="min-h-12 w-full rounded-[14px] border border-line bg-surface px-4 py-3.5 text-[15px] text-ink placeholder:text-faint"
      />
    </div>
  );
}
