// One consistent, dependency-free SVG icon set for the whole app — 24px
// grid, 1.75 stroke, round caps/joins, currentColor — replacing the emoji
// that used to stand in for icons (rendered differently on every OS/font,
// couldn't be colored or sized consistently, and read inconsistently to
// screen readers). Decorative by default (aria-hidden); pass `label` when
// the icon is the only thing conveying meaning.

const PATHS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  package: (
    <>
      <path d="M3.5 7.5 12 3.25l8.5 4.25v9L12 20.75 3.5 16.5z" />
      <path d="M3.5 7.5 12 11.75l8.5-4.25M12 11.75v9" />
    </>
  ),
  folder: <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.25h8A1.5 1.5 0 0 1 20.5 9.25V17.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />,
  message: <path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9.5A1.5 1.5 0 0 1 19 17h-9l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5z" />,
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-1.75-3 1.75-3-1.75-3 1.75z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5.5 12v8h13v-8M12 8v12" />
      <path d="M12 8c-1-2.75-5-3.25-5-1.25S10 8 12 8zM12 8c1-2.75 5-3.25 5-1.25S14 8 12 8z" />
    </>
  ),
  plusCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.25v7.5M8.25 12h7.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-5.75 6-5.75s6 2.45 6 5.75" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.5c2 .7 3.5 2.6 3.5 5.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 5.34l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1-1" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.5-.75 1.5-1.5 0-1-.75-1.4-.75-2.25 0-.9.7-1.6 1.7-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.4-3.8-8.15-8.5-8.15z" />
      <circle cx="7.75" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.25" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.75" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  file: (
    <>
      <path d="M7 3.5h7l4.5 4.5v12a.5.5 0 0 1-.5.5H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.75" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.75" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.75" cy="17.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  redirect: (
    <>
      <path d="M20 7.5H9a5 5 0 0 0 0 10h6" />
      <path d="M16.5 4 20 7.5 16.5 11" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M3.5 10h17M15.5 14.5h2" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v15.5a.5.5 0 0 0 .5.5H20" />
      <path d="m7.5 14.5 3.5-4 3 2.75 5-6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  shield: <path d="M12 3.25 4.5 6v6c0 4.4 3.2 8 7.5 8.75 4.3-.75 7.5-4.35 7.5-8.75V6z" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="M5 12.5 9.5 17 19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.25 12.25 2.5 2.5 5-5" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9.25 9.25 5.5 5.5M14.75 9.25l-5.5 5.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  trash: <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M9.5 7V4.5h5V7" />,
  alert: (
    <>
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 16.75h.01" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9.5 12 4.5l8.5 5" />
      <path d="M5.5 10v7.5M9.75 10v7.5M14.25 10v7.5M18.5 10v7.5M3.5 20h17" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6.5h11v9.5h-11zM13.5 9.5h4l3 3.25V16h-7" />
      <circle cx="6.5" cy="17.75" r="1.75" />
      <circle cx="17" cy="17.75" r="1.75" />
    </>
  ),
  bell: (
    <>
      <path d="M6 15.5V11a6 6 0 1 1 12 0v4.5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.45 5.45l1.4 1.4M17.15 17.15l1.4 1.4M5.45 18.55l1.4-1.4M17.15 6.85l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.6A7.75 7.75 0 0 1 9.4 4.5a7.75 7.75 0 1 0 10.1 10.1z" />,
  star: <path d="m12 3.75 2.6 5.3 5.85.85-4.23 4.12 1 5.82L12 17.1l-5.22 2.74 1-5.82L3.55 9.9l5.85-.85z" />,
  cart: (
    <>
      <path d="M3 4h2.25l2.3 10.75a1 1 0 0 0 1 .75h9.2a1 1 0 0 0 1-.78L20.5 8H6.1" />
      <circle cx="9.5" cy="19.25" r="1.25" />
      <circle cx="17" cy="19.25" r="1.25" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 12.75 8.5 17.5 10.25 12.75 12 11 17l-1.75-5L4.5 10.25 9.25 8.5z" />
      <path d="M18 15.5l.75 2 2 .75-2 .75-.75 2-.75-2-2-.75 2-.75z" />
    </>
  ),
  zap: <path d="M13.25 2.75 4.5 13.75h6.75l-1 7.5 8.75-11h-6.75z" />,
  card: (
    <>
      <rect x="2.75" y="5.5" width="18.5" height="13" rx="2" />
      <path d="M2.75 9.75h18.5M6.5 15h3.5" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5h3a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3" />
      <path d="M9.5 8 5.5 12l4 4M5.5 12h10" />
    </>
  ),
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.5 13.5h5l1.25 2.5h4.5l1.25-2.5h5" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5.25 4.5h13.5L20 9.5" />
      <path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0" />
      <path d="M5.5 11.5v8.5h13v-8.5M10 20v-4.5h4V20" />
    </>
  ),
  external: (
    <>
      <path d="M13.5 4.5h6v6M19.5 4.5l-8 8" />
      <path d="M17.5 13.5v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </>
  ),
  rocket: (
    <>
      <path d="M12.5 15.5 8.5 11.5C10.5 6 14.5 3.5 20.5 3.5c0 6-2.5 10-8 12z" />
      <path d="M8.5 11.5 5 11l2.5-3.5 4 .5M12.5 15.5l.5 3.5 3.5-2.5-.5-4" />
      <path d="M6 16.5c-1.5.5-2 2.5-2 3.5 1 0 3-.5 3.5-2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  filled = false,
  label,
  className = "",
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {PATHS[name]}
    </svg>
  );
}

// Star ratings rendered as SVG instead of "★★★★☆" text glyphs — a real
// accessible name ("4 من 5"), and partial fills read as clearly empty
// outlines rather than a lighter font glyph some fonts barely distinguish.
export function Stars({ rating, size = 16, className = "", label }: { rating: number; size?: number; className?: string; label?: string }) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={label ?? `${value} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={size} filled={i < value} strokeWidth={1.5} className={i < value ? "" : "opacity-40"} />
      ))}
    </span>
  );
}
