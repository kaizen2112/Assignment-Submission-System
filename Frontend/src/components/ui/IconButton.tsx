"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon-only actions for the last column of a table. Text buttons in every row turn a table into a wall
// of words; an icon that appears on hover keeps the data readable and the action one pixel away.
//
// `label` is required and is NOT optional decoration — an icon-only control with no accessible name is
// invisible to a screen reader, so it becomes both the aria-label and the native tooltip.

type Tone = "neutral" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
  danger: "text-gray-500 hover:bg-red-50 hover:text-red-600",
};

const BASE = cn(
  "inline-flex size-8 items-center justify-center rounded-lg",
  "transition-colors duration-150",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "[&>svg]:size-4",
);

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  tone?: Tone;
  loading?: boolean;
}

export function IconButton({
  label,
  icon,
  tone = "neutral",
  loading = false,
  disabled,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(BASE, TONES[tone], className)}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : icon}
    </button>
  );
}

// The same control as a navigation. A <Link> styled as a button rather than a button that calls
// router.push, so middle-click and "open in new tab" keep working.
export function IconLink({
  href,
  label,
  icon,
  tone = "neutral",
  className,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Link href={href} aria-label={label} title={label} className={cn(BASE, TONES[tone], className)}>
      {icon}
    </Link>
  );
}

// Wraps a row's actions. `opacity-0 group-hover:opacity-100` is the effect the design asks for, but it
// must not hide the controls from keyboard users — focus-within brings them back, and they stay visible
// unconditionally on touch screens, where there is no hover at all.
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        "transition-opacity duration-150",
      )}
    >
      {children}
    </div>
  );
}
