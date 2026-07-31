// Flat ESLint config (ESLint 9+). Shared across the monorepo.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/*.generated.*",
      "packages/database/prisma/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "Import validated env from @cc/shared/env instead of reading process.env directly.",
        },
      ],
    },
  },
  // Env module and scripts are allowed to read process.env directly.
  {
    files: ["packages/shared/src/env.ts", "scripts/**/*.ts", "**/*.config.*"],
    rules: { "no-restricted-globals": "off" },
  },
  prettier,
);
