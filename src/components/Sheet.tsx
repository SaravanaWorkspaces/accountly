"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The bottom sheet every form in Accountly opens in: anchored to the bottom on
 * phones, centred to 560px on wider screens. Escape and a backdrop tap close
 * it, and focus is kept inside while it is open.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  role = "dialog",
  describedBy,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** `alertdialog` for a destructive confirm, so screen readers interrupt. */
  role?: "dialog" | "alertdialog";
  /** Id of the text that spells out what is about to happen. */
  describedBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const restoreFocusTo = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Land on the first field rather than the close button.
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const targets = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (targets.length === 0) return;

      const edge = event.shiftKey ? targets[0] : targets[targets.length - 1];
      if (document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? targets[targets.length - 1] : targets[0]).focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusTo?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={title}
        aria-describedby={describedBy}
        className="no-scrollbar max-h-[92dvh] w-full max-w-[560px] animate-up-in overflow-y-auto rounded-t-[26px] bg-canvas px-5 pt-[22px] pb-[calc(28px+env(safe-area-inset-bottom))] sm:rounded-[26px] sm:pb-7"
      >
        <div className="mb-[18px] flex items-center justify-between gap-3">
          <h2 className="font-serif text-[25px] leading-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target-square flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-base text-body transition-colors hover:bg-line"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
