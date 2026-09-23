import { initialsOf } from "@/lib/party";

/** The rounded initials tile used on party cards and the detail header. */
export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  const dimensions =
    size === "lg"
      ? "h-[52px] w-[52px] rounded-[15px] text-lg"
      : "h-[42px] w-[42px] rounded-xl text-[15px]";

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-raised font-semibold text-ink ${dimensions}`}
    >
      {initialsOf(name)}
    </span>
  );
}
