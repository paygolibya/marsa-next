// Hand-mirrored from tailwind.config.ts's theme.extend.colors — the single
// place to update if the brand palette ever changes, instead of a second
// silent hex copy. Needed because Tailwind config values aren't importable
// at runtime into a Recharts stroke=/fill= prop (those need real CSS color
// strings, not Tailwind class names). Light-mode values only — canvas/
// canvas-dim are CSS variables that flip in dark mode (see globals.css),
// which these plain hex constants don't track; acceptable for chart
// gridlines/axes, not worth the runtime complexity of reading the CSS
// variable for this.
export const CHART_COLORS = {
  harbor: "#0E2A3F",
  brass: "#EFB11D",
  signal: "#E43D12",
  canvasDim: "#E0DCCF",
  rope: "#8A7A5C",
} as const;
