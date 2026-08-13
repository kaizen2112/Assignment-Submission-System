import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone — the traced subset of node_modules plus a generated server.js — so the
  // Docker runtime stage can drop node_modules entirely. Without this the image would have to carry
  // the full dependency tree (~400 MB) just to run `next start`.
  output: process.env.VERCEL ? undefined : "standalone",
  // Fail the production build on a type error instead of shipping one. This is the default, but
  // stated explicitly because docs/07 requires strict TypeScript with no `any`.
  typescript: { ignoreBuildErrors: false },
  // No `eslint` key here: Next 16 removed lint-during-build along with `next lint`, so the option no
  // longer exists on NextConfig. Linting is its own step — `npm run lint` — and CI runs it separately.
};

export default nextConfig;
