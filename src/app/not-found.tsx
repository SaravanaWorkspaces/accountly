import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-[20px] border border-dashed border-line-dash bg-surface px-6 py-11 text-center">
      <p className="mb-2 font-serif text-2xl text-ink">Nothing here</p>
      <p className="mb-5 text-[15px] text-muted">That page does not exist.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-canvas no-underline transition-colors hover:bg-accent hover:no-underline"
      >
        Back to all parties
      </Link>
    </div>
  );
}
