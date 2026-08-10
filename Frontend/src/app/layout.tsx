import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assignment & Submission Management System",
  description:
    "Role-based assignment and submission management for teachers, students and administrators.",
};

// A server component on purpose. The auth redirect lives in page.tsx and the per-role layouts, not
// here: reading localStorage requires the client, and making the root layout a client component would
// opt every page in the app out of server rendering.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
