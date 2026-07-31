import { defineConfig } from "vitest/config";

/**
 * Root Vitest config. Individual packages may extend or override this via their
 * own `vitest.config.ts`. Deterministic packages (mtg, deck-validator) must run
 * without any network or OpenAI dependency (see CLAUDE.md).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/dist/**", "**/*.config.*", "**/*.d.ts", "scripts/**"],
    },
  },
});
