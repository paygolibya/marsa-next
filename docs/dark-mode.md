# Dark mode

A manual toggle (🌙/☀️ button in the public nav, dashboard sidebar, and
admin sidebar), defaulting to the visitor's OS preference on first visit
and persisted in `localStorage` (`rifqa-theme`) after that.

## Why this is a "pragmatic retrofit," not a rewrite

This app has two parallel styling patterns: the branded palette (`canvas`,
`harbor`, `brass`, `signal`, `rope`, `ink` — used on the storefront, auth
pages, onboarding, and dashboard chrome) and plain Tailwind grays/whites/
status-badge colors (used across every admin page and several dashboard
pages, e.g. `bg-white`, `text-gray-600`, `bg-green-100`). Retrofitting
real theme-awareness onto ~80 files without rewriting every className
string needed two different techniques:

1. **CSS variables for `canvas`/`canvas-dim`/`ink`** (`tailwind.config.ts`
   + `globals.css`) — Tailwind's documented `rgb(var(--x) / <alpha-value>)`
   pattern, which is what still lets `bg-canvas/10`-style opacity
   modifiers work. Every page already builds on these three tokens for
   its background/body-text, so this alone covers most of the app with
   zero component changes.

2. **A CSS override layer for everything a variable swap can't safely
   flip on its own** (`globals.css`, placed after `@tailwind utilities`
   so plain source order — not `!important` — wins). Written as flat
   selectors (`.dark .text-harbor { ... }`), not CSS nesting — this
   project's PostCSS config has no nesting plugin, and nested syntax here
   silently fails the build.

## Two real bugs a variable-swap alone caused — found by actually looking

Both were only caught by screenshotting the app in dark mode, not by
reading the CSS:

- **`harbor` is dual-role**: a permanent dark panel color (`bg-harbor`
  sidebars/hero/footer, which should stay dark in both themes) *and* a
  text/border color on the canvas background (`text-harbor` headings,
  `border-harbor` opacity variants). Making `harbor` itself a
  theme-flipping variable would have relighted every sidebar along with
  fixing the headings. Fixed by leaving `harbor` a static hex value and
  overriding just the `text-harbor`/`border-harbor`/`bg-harbor` opacity
  variants used as accents, not backgrounds.
- **`canvas` turned out to have the same problem**: the landing page's
  hero and the dashboard sidebar are both permanently-dark `bg-harbor`
  panels that use `text-canvas`/`border-canvas`/`bg-canvas` opacity
  variants as their *light* text and dividers (`<section className="bg-harbor
  text-canvas">` in `page.tsx`). Flipping `canvas`'s variable — correct
  for its main role as the page background — turned that light text
  dark-on-dark and made the entire hero heading unreadable. Every
  `text-canvas`/`border-canvas` usage in the codebase (grepped, not
  guessed) turned out to be inside one of these dark panels, so those are
  pinned back to the original light-cream values regardless of theme;
  only plain `bg-canvas` and the nav bar's `bg-canvas/95` backdrop are
  left to flip naturally.
- A related, smaller version of the same thing: `bg-white/40` and
  `bg-white/60` (translucent cards on the landing page) aren't covered by
  overriding plain `bg-white` — Tailwind compiles the opacity variant to
  its own separate class. Missing this made the pricing page's two
  non-highlighted cards render as a jarring light-gray box against the
  dark page instead of blending in. Added explicit overrides for every
  opacity variant actually used (grepped: `/15`, `/25`, `/40`, `/50`,
  `/60`), not just the bare utility.

## What's covered

Every color utility actually used in `src/` was grepped and enumerated
before writing the override layer (not guessed) — `harbor`/`canvas`
opacity variants, plain grays 50 through 900, `bg-white` and its opacity
variants, and the `bg-{hue}-50/100` + `text-{hue}-600/700/800` status-pill
pattern for blue/green/emerald/yellow/red/orange/purple. Solid colored
buttons (e.g. `bg-green-600`, `bg-red-800`) are deliberately left
unchanged — they already have enough contrast against any background,
light or dark.

A utility combination introduced later that isn't in this list will just
silently stay light-mode-colored in dark mode rather than error — add it
to the override layer in `globals.css` when that happens.

## No-flash-of-wrong-theme

`src/lib/theme-context.tsx` exports `THEME_INIT_SCRIPT`, a plain string
(not a React component) injected as a blocking `<script>` in
`layout.tsx`'s `<head>`. It runs before React hydrates and sets `.dark`
on `<html>` synchronously from `localStorage` (or `prefers-color-scheme`
if nothing's stored yet) — without this, every page would flash light
mode for a moment even for a user whose OS prefers dark.

## Live-verified

Actually screenshotted (Playwright, installed temporarily with
`--no-save` for this verification, then removed — not a project
dependency) rather than just trusting the CSS:
- Landing page hero, pricing cards, and footer — light and dark.
- Login and register forms (the shared `.input` class).
- Dashboard overview, the payouts page (plain-gray-pattern content
  inside the branded chrome), and settings (the `.input` class again,
  plus the new domain settings section).
- Admin merchants list (status badges: green/blue pill patterns, against
  real production data) and admin payouts (info banner, stat tiles,
  filter tabs).

No console/page errors in any of these captures. The two real bugs above
were both caught and fixed during this pass, not shipped and found later.

## Known gaps

- Coverage is broad, not exhaustive — a page/component using a color
  utility not in the enumerated list (see "What's covered") will still
  render in its light-mode colors even with `.dark` active. Storefront
  templates (the customer-facing store themes, as opposed to the
  merchant dashboard) weren't specifically audited in this pass.
- The override layer hardcodes color values rather than deriving them
  from a systematic dark-mode color scale — reasonable for the size of
  this app today, but would need rethinking if the palette grows much
  further.
