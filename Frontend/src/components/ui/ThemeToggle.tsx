"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

// The light/dark switch in the top bar.
//
// Note what this component does NOT do: decide the theme. The inline script in the root layout has
// already applied it during HTML parsing, so by the time this mounts the class on <html> is the source
// of truth. A `useState(false)` here would fight that — it would render the wrong icon on the first
// paint of a dark page and then correct itself, which is the same flash the script exists to prevent.
//
// So there is no state at all. The icons are chosen by CSS from the same class the script set, which
// means they are right in the very first frame and cannot disagree with the page around them; the click
// handler reads the DOM rather than a mirror of it.
export function ThemeToggle() {
  // A repair for development only. React's Strict Mode remounts once, and on that remount it resets
  // <html> to just the attributes it manages from JSX — which clears the class the inline script set,
  // silently reverting a dark page to light. Production renders once and never hits this.
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const dark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = () => {
    // `.toggle()` returns the resulting state, so the class list decides and localStorage records —
    // rather than both being written from a guess about which one was already correct.
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      // A static label. "Switch to dark" would have to be derived from state this component
      // deliberately does not hold, and would be wrong for one frame if it were.
      aria-label="Toggle theme"
      title="Toggle theme"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      {/* Both icons are always in the DOM and CSS picks one. This is what keeps the button correct on
          the first paint without any JavaScript having run. */}
      <Sun aria-hidden="true" className="hidden size-4.5 dark:block" />
      <Moon aria-hidden="true" className="size-4.5 dark:hidden" />
    </button>
  );
}
