import type { Config } from "tailwindcss";

// Design tokens for the "Marsa" (harbor) identity — see README-design.md
// for the full rationale. Named for the subject, not for generic Tailwind
// slate/gray defaults, so components read intentionally in markup.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        harbor: "#0E2A3F", // deep navy — dark sections, headers. Deliberately
        // NOT theme-aware: it's used as a permanent dark accent (sidebars,
        // solid buttons, footer) that reads fine on a dark page too. Where
        // it's used as *text* on the (theme-aware) canvas background —
        // text-harbor, border-harbor/* — see the .dark overrides in
        // globals.css instead; flipping this variable itself would also
        // wrongly relight every bg-harbor panel.
        "harbor-deep": "#081D2C",
        // canvas/canvas-dim/ink are the three tokens that actually flip
        // between light and dark — see the CSS custom properties in
        // globals.css. rgb(var(...) / <alpha-value>) is Tailwind's
        // documented pattern for a CSS-variable color that still supports
        // the /opacity modifier (bg-canvas/10 etc, used throughout).
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        "canvas-dim": "rgb(var(--color-canvas-dim) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        brass: "#EFB11D", // accent gold — links, icons, stamps. Matches the
        // charm/rivet color in the Rifqa bag logo. Works on both themes unchanged.
        "brass-light": "#F5CC6C",
        signal: "#E43D12", // primary CTA — the logo's orange-red. Unchanged across themes.
        "signal-dark": "#B6310E",
        // The logo's pink bag body — a second brand accent alongside brass/
        // signal, for badges and highlights that shouldn't compete with the
        // primary CTA color. Works on both themes unchanged.
        rose: "#D6536D",
        "rose-light": "#FFA2B6",
        rope: "#8A7A5C", // muted secondary text — mid-tone enough to stay legible on both themes unchanged.
      },
      fontFamily: {
        display: ["var(--font-cairo)", "sans-serif"],
        body: ["var(--font-tajawal)", "sans-serif"],
      },
      backgroundImage: {
        "compass-ring":
          "radial-gradient(circle, transparent 0%, transparent 62%, rgba(239,233,218,0.06) 63%, rgba(239,233,218,0.06) 64%, transparent 65%)",
      },
    },
  },
  plugins: [],
};

export default config;
