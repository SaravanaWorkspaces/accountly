import { redirect } from "next/navigation";

import { PasscodeForm } from "@/components/PasscodeForm";
import { authEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!authEnabled()) redirect("/");

  const { next = "/" } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[420px] flex-col justify-center">
      <div className="mb-6 text-center">
        <p className="font-serif text-[34px] leading-none tracking-[-0.01em] text-ink">
          Accountly
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-subtle">ledger</p>
      </div>

      <div className="rounded-[22px] border border-line bg-surface p-[22px]">
        <p className="mb-4 text-[15px] text-muted">
          Enter the passcode to open your ledger.
        </p>
        <PasscodeForm next={next} />
      </div>
    </div>
  );
}
