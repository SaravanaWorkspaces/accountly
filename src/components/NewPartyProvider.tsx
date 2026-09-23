"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { NewPartySheet } from "./NewPartySheet";

const NewPartyContext = createContext<{ openNewParty: () => void }>({
  openNewParty: () => {},
});

/**
 * "New party" is reachable from the header and from the empty state, so the
 * sheet is owned once here and opened through context from either place.
 */
export function NewPartyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Saving a party navigates to it; close the sheet once that lands.
  useEffect(() => setOpen(false), [pathname]);

  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openNewParty: () => setOpen(true) }), []);

  return (
    <NewPartyContext.Provider value={value}>
      {children}
      <NewPartySheet open={open} onClose={close} />
    </NewPartyContext.Provider>
  );
}

export function useNewParty() {
  return useContext(NewPartyContext).openNewParty;
}
