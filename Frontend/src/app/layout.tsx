import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import NextTopLoader from "nextjs-toploader";
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

// Resolves the theme before the browser paints anything.
//
// This has to be an inline script rather than an effect in the toggle component. useEffect runs after
// hydration *and* after paint, so the user would see a white page flash to dark on every load;
// useLayoutEffect runs before paint but still after hydration, so on a slow connection the browser has
// already painted the server's HTML. Only a synchronous script in <head> runs during HTML parsing,
// which is before there is anything to flash.
//
// No stored preference falls back to the OS setting, so someone whose machine is in dark mode gets a
// dark app on first visit without having to find the toggle. try/catch because localStorage throws
// outright in Safari's private mode rather than returning null.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("theme");var d=s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning is required, not defensive: the script above changes <html>'s class list
    // before React hydrates, so the DOM deliberately disagrees with the server's markup. Without it
    // React treats that as an error and client-renders from the nearest boundary, which throws away the
    // correction and reintroduces the flash.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        {/* The thin progress bar every SaaS app has. It is not decoration: an App Router navigation
            that waits on a server component renders nothing at all until it resolves, so without this
            a click on a sidebar link looks like it did nothing. 2px and no spinner — it should be
            noticed peripherally, not read. */}
        <NextTopLoader color="#4f46e5" height={2} showSpinner={false} shadow={false} />
        {children}
      </body>
    </html>
  );
}
