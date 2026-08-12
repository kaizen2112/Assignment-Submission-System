import { cn } from "@/lib/utils";

// A thin bar under the marks input that fills as a grade is typed. Purely visual — it computes nothing
// the form does not already know and enforces nothing; rule 5's actual bound lives in SubmissionService,
// with the Zod schema mirroring it.
//
// Why it earns its place: "72" means nothing until you also read "out of 90". The bar turns two numbers
// into one glance, which is the whole job of a grading screen a teacher uses forty times in a row.

// Bands chosen to match how a pass mark is usually read, not to be evenly spaced.
function toneFor(fraction: number): { bar: string; text: string; label: string } {
  if (fraction >= 0.6) return { bar: "bg-green-500", text: "text-green-600", label: "Strong" };
  if (fraction >= 0.4) return { bar: "bg-amber-500", text: "text-amber-600", label: "Borderline" };
  return { bar: "bg-red-500", text: "text-red-600", label: "Weak" };
}

export function MarksMeter({ marks, maxMarks }: { marks: number; maxMarks: number }) {
  // A NaN marks value is normal — an empty number input yields NaN, and the field starts empty when
  // re-grading is not in progress. Treated as "nothing entered yet" rather than as zero, because a bar
  // sitting at red before the teacher has typed anything reads as a verdict.
  const entered = Number.isFinite(marks) && maxMarks > 0;

  // Clamped so a value over the maximum — which Zod will reject a moment later — cannot overflow the
  // track while the message is still being read.
  const fraction = entered ? Math.min(Math.max(marks / maxMarks, 0), 1) : 0;
  const percent = Math.round(fraction * 100);
  const tone = toneFor(fraction);

  return (
    <div className="flex flex-col gap-1.5">
      {/* aria-hidden: the input itself already announces its value, min and max. A progressbar role here
          would make a screen reader read the same number twice. */}
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-300 ease-out",
            entered ? tone.bar : "bg-transparent",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span className="text-gray-400">
          {entered ? `${percent}%` : "Enter a mark"}
        </span>
        {entered && <span className={cn("font-medium", tone.text)}>{tone.label}</span>}
      </div>
    </div>
  );
}
