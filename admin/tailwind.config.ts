import type { Config } from "tailwindcss";

/**
 * Palette per frontend spec §7: cool neutral (zinc) base with a single accent reserved for
 * primary actions and active/published status. The accent is a slightly desaturated cool blue —
 * calm enough for an all-day ops tool, and deliberately not the stock indigo/violet default.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#eef4ff",
          100: "#dbe6fe",
          200: "#bfd2fd",
          300: "#93b4fb",
          400: "#6090f6",
          500: "#3a6ff0",
          600: "#2854d8",
          700: "#2243ad",
          800: "#213c8a",
          900: "#20376e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Tables run dense (§7); 13px is the workhorse size for data rows.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs: ["0.75rem", { lineHeight: "1.05rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(24 24 27 / 0.04), 0 1px 3px 0 rgb(24 24 27 / 0.06)",
        overlay: "0 10px 38px -10px rgb(24 24 27 / 0.22), 0 10px 20px -15px rgb(24 24 27 / 0.16)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // Functional only — drawer/dialog/toast entrances (§7: no ambient motion).
        "fade-in": "fade-in 120ms ease-out",
        "slide-in-right": "slide-in-right 180ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-up": "slide-up 120ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
