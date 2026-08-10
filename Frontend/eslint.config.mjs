import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships a native flat config. The older `FlatCompat` + `compat.extends()`
// wrapper is not just unnecessary here, it throws: running the already-flat config back through the
// eslintrc compatibility layer produces a circular plugin reference that ESLint dies on while trying
// to JSON.stringify its own validation errors.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // globalIgnores replaces eslint-config-next's defaults rather than adding to them, so its entries
  // are repeated here on purpose.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
