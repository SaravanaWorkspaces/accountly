"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-[20px] border border-dashed border-line-dash bg-surface px-6 py-11 text-center">
      <p className="mb-2 font-serif text-2xl text-ink">Something went sideways</p>
      <p className="mb-5 text-[15px] text-muted">
        The ledger could not be loaded. Your entries are safe on disk.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-accent"
      >
        Try again
      </button>
    </div>
  );
}
