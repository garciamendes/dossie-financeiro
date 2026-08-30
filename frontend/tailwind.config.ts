import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        carbon: "var(--carbon)",
        "carbon-dark": "var(--carbon-dark)",
        "stamp-red": "var(--stamp-red)",
        "stamp-green": "var(--stamp-green)",
        brass: "var(--brass)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
        stamp: ["var(--font-special-elite)", "var(--font-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
