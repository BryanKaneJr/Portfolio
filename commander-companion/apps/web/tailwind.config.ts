import type { Config } from "tailwindcss";

/** Tailwind config. shadcn/ui tokens/theme are layered in during Phase 1 (CC-UI-001). */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
