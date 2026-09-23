import type { InputHTMLAttributes, ReactNode } from "react";

const INPUT_CLASS =
  "min-h-12 w-full rounded-[13px] border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-faint";

/** A labelled field in a sheet: small muted label above a rounded input. */
export function Field({
  label,
  hint,
  required,
  className = "",
  inputClassName = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  inputClassName?: string;
}) {
  return (
    <label className={`flex flex-col gap-[7px] text-[13px] text-muted ${className}`}>
      <span>
        {label}
        {required ? <span className="text-accent"> · required</span> : null}
      </span>
      {/*
        `aria-required` rather than `required`: the design answers a missing
        name with its own inline message, not the browser's native bubble.
      */}
      <input
        aria-required={required || undefined}
        className={`${INPUT_CLASS} ${inputClassName}`}
        {...props}
      />
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export { INPUT_CLASS };
