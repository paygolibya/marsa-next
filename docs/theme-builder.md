# Theme builder / store customizer

## What was actually broken

Investigated before touching anything (per the user's report that "the
theme builder doesn't work correctly" and "the basic is completely zero
level"), rather than assuming a redesign was needed:

- **Logo/favicon upload did nothing at all.** Both file inputs'
  `onChange` handlers were `console.log(file)` — never uploaded, never
  saved, never applied anywhere. Fixed with a real upload
  (`POST /api/uploads/image`, Vercel Blob — same mechanism as
  `/api/payments/upload-receipt`).
- **The "live preview" was a hardcoded, inaccurate mockup** — gray boxes
  labeled "صورة منتج 1/2/3", not remotely resembling the real store page.
  This is exactly why "people can't see the style": the preview never
  represented what a buyer would actually see. Rebuilt to mirror
  `src/app/store/[slug]/page.tsx`'s actual structure/typography.
- **Several toggles were checkboxes with nothing behind them**:
  `accentColor`, `headerStyle`, `footerStyle`, `showNewsletter`,
  `showTestimonials`, `showSocialProof` were all captured in the
  customizer and saved to the DB, but `store/[slug]/page.tsx` never read
  any of them — checking the box changed nothing a buyer would ever see.
  All six are now real:
  - `showSocialProof` — a real stats bar (delivered order count, average
    rating), computed from that store's actual `Order`/`ProductReview`
    rows. Not invented numbers.
  - `showTestimonials` — real 4★+ reviews already left on the store's own
    products, not authored copy.
  - `showNewsletter` — a real capture (`NewsletterSubscriber` table +
    `POST /api/newsletter/subscribe`), not a decorative form.
  - `headerStyle` — `standard` (existing layout) vs `centered`.
  - `footerStyle` — `standard` vs `branded`, which required extending
    `SiteFooter` to accept a `store` prop at all — previously it always
    rendered the *platform's* footer regardless of any per-store setting,
    since it took zero props.
  - `accentColor` — now used for star ratings and stat badges.
- **A new store always started at the same hardcoded blue
  (`#0066cc`/`#f0f0f0`)** regardless of which template was picked, even
  though `Template.defaultColors` already existed with real per-template
  values (confirmed: `luxury` → `#1f2937`/`#f59e0b`, `bold` →
  `#ef4444`/`#fef2f2`, etc.) — nothing ever read it.
  `POST /api/stores` now applies the chosen template's own defaults.
- **`onboarding/customize` hardcoded `templateName = "الحديث"`**
  regardless of which template the merchant actually picked — fixed by
  fetching the real store + its real template name.

## A separate, more serious finding — flagged, not fixed here

**The templates a merchant picks from (`الفاخر`/`السوق`/etc., some of
them paid) do not actually change how their store renders at all.**
`store/[slug]/page.tsx` is one single layout for every store; nothing in
it branches on `Store.templateId` or `Template.componentPath`. Two
merchants who each paid for a different "premium" template get the exact
same page structure — only whatever colors happen to differ. This wasn't
in scope to fix here (it means designing and building genuinely distinct
layouts per template, a much larger effort than fixing the customizer),
but it's worth knowing about directly, especially for any template
currently being sold as visually distinct.

## Known gaps after this pass

- Real file upload (logo/favicon) couldn't be live-tested from this
  environment — `BLOB_READ_WRITE_TOKEN` isn't set locally. Everything
  else (customize save, public API stats/testimonials, newsletter
  subscribe + duplicate handling, per-template default colors) was
  live-verified against the real database.
- `showReviews` (product review display) was already wired up before
  this pass — not touched.
- No unsubscribe link/flow exists for newsletter subscribers yet.
