import { cn, initials } from "@/lib/utils";

// Initials in a circle. No image upload exists in this system (A3 rules out file handling entirely), so
// this is not a placeholder for a photo — it is the whole avatar, which is why it uses the accent colour
// rather than a gray that would read as "missing".
//
// aria-hidden: the initials are a compressed form of a name that is always rendered next to them, so
// announcing "AR" before "Ayesha Rahman" is noise.
export function Avatar({
  fullName,
  size = "md",
  className,
}: {
  fullName: string | undefined | null;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "bg-indigo-600 font-semibold text-white",
        size === "sm" ? "size-7 text-[10px]" : "size-8 text-xs",
        className,
      )}
    >
      {initials(fullName)}
    </span>
  );
}
