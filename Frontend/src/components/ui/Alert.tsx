import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "error" | "warning" | "info";

const TONES: Record<AlertTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

// role="alert" only for errors: it interrupts a screen reader immediately, which is right for a failure
// and wrong for an informational note. The softer tones announce politely via role="status".
export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2 text-sm", TONES[tone], className)}
    >
      {children}
    </div>
  );
}
