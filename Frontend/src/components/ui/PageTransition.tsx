"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

// The fade-and-rise every page enters with. Wrapped around the content column in AppShell rather than
// pasted into 22 page files, so no page can forget it and none can disagree about the duration.
//
// 200ms and 8px are both deliberately small. The job is to make a navigation feel like it landed rather
// than like it cut — long enough to read as motion, short enough that nobody waiting on the third page
// of a table ever notices they are waiting for an animation.
export function PageTransition({ children }: { children: ReactNode }) {
  // The global `prefers-reduced-motion` rule in globals.css neutralises CSS transitions, but Framer
  // animates inline styles from JavaScript and never sees that media query. Without this the one person
  // who asked the OS for no motion is the only person who still gets it.
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
