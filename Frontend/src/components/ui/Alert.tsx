import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "error" | "warning" | "info" | "success";

// Same tint-flip as Badge, one step stronger: an alert is a full-width panel rather than a chip, so its
// fill is `-950/30` — light enough to tell apart from the card behind it, dark enough not to glare.
// The icon keeps its own brighter shade so it stays the first thing the eye lands on.
const TONES: Record<AlertTone, { box: string; icon: string; Icon: typeof Info }> = {
  error: {
    box: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
    icon: "text-red-500 dark:text-red-400",
    Icon: XCircle,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "text-amber-500 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  info: {
    box: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    icon: "text-blue-500 dark:text-blue-400",
    Icon: Info,
  },
  success: {
    box: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
    icon: "text-green-600 dark:text-green-400",
    Icon: CheckCircle2,
  },
};

// role="alert" only for errors: it interrupts a screen reader immediately, which is right for a failure
// and wrong for an informational note. The softer tones announce politely via role="status".
//
// The icon is aria-hidden — it duplicates the tone the role already conveys, and reading "warning" twice
// is worse than not reading it at all.
export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon, Icon } = TONES[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm", box, className)}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
