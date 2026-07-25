import type { Config } from "tailwindcss";

// Design tokens for the "Marsa" (harbor) identity — see README-design.md
// for the full rationale. Named for the subject, not for generic Tailwind
// slate/gray defaults, so components read intentionally in markup.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        harbor: "#0E2A3F", // deep navy — dark sections, headers
        "harbor-deep": "#081D2C",
        canvas: "#EFE9DA", // warm sail-cloth off-white — light sections
        "canvas-dim": "#E4DCC8",
        brass: "#B8752E", // accent — links, icons, stamps
        "brass-light": "#D89A55",
        signal: "#C1443C", // primary CTA red
        "signal-dark": "#9E332C",
        rope: "#8A7A5C", // muted secondary text on canvas
        ink: "#1B1B18", // near-black text
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
