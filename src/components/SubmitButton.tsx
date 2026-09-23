"use client";

import { useFormStatus } from "react-dom";

/** Primary sheet action. Disables itself while the server action is in flight. */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] rounded-[14px] bg-ink px-4 py-[15px] text-base font-semibold text-canvas transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
