import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fail the production build on a type error instead of shipping one. This is the default, but
  // stated explicitly because docs/07 requires strict TypeScript with no `any`.
  typescript: { ignoreBuildErrors: false },
  // No `eslint` key here: Next 16 removed lint-during-build along with `next lint`, so the option no
  // longer exists on NextConfig. Linting is its own step — `npm run lint` — and CI runs it separately.
};

export default nextConfig;
