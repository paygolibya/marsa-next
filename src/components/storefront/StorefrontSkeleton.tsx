// Placeholder shown while a storefront's data loads client-side
// (api.publicStore). Previously these pages rendered nothing at all until
// the request finished — a blank white screen for a second or more on a
// slow mobile connection, which reads as "broken" to a shopper arriving
// from an ad. Neutral grays only: the store's own colors aren't known yet.
function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-xl bg-gray-200/80 dark:bg-white/10 ${className}`} />;
}

export function StorefrontSkeleton({ variant = "store", label }: { variant?: "store" | "product"; label: string }) {
  return (
    <div className="min-h-screen bg-white dark:bg-harbor-deep animate-pulse motion-reduce:animate-none" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 px-4 py-4 sm:px-8">
        <Block className="h-9 w-28" />
        <div className="flex gap-3">
          <Block className="h-9 w-9 rounded-full" />
          <Block className="h-9 w-9 rounded-full" />
        </div>
      </div>

      {variant === "store" ? (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <Block className="mb-10 h-48 w-full sm:h-64" />
          <Block className="mb-6 h-6 w-40" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Block className="mb-3 aspect-square w-full" />
                <Block className="mb-2 h-4 w-3/4" />
                <Block className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-8 md:grid-cols-2">
          <Block className="aspect-square w-full" />
          <div>
            <Block className="mb-4 h-8 w-3/4" />
            <Block className="mb-8 h-7 w-1/3" />
            <Block className="mb-2 h-4 w-full" />
            <Block className="mb-2 h-4 w-5/6" />
            <Block className="mb-8 h-4 w-2/3" />
            <Block className="h-12 w-full rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}

export function StorefrontLoadError({ heading, subtext, retryLabel, onRetry }: { heading: string; subtext: string; retryLabel: string; onRetry: () => void }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center animate-rise-in">
      <h1 className="font-display text-2xl font-bold text-harbor">{heading}</h1>
      <p className="text-rope mt-2 mb-6">{subtext}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-harbor px-8 font-bold text-white transition hover:bg-harbor-deep"
      >
        {retryLabel}
      </button>
    </main>
  );
}

// Shown when the merchant's trial/paid period has ended unpaid (the public
// store API answers 423 — see lib/subscription/access.ts). Neutral wording
// for shoppers; nothing about the merchant's subscription is exposed.
export function StorePausedNotice({ heading, subtext }: { heading: string; subtext: string }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center animate-rise-in">
      <div className="rounded-3xl bg-white p-8 shadow-xl">
      <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-harbor/10 text-harbor" aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      </span>
      <h1 className="font-display text-2xl font-bold text-harbor">{heading}</h1>
      <p className="mt-2 leading-relaxed text-harbor/70">{subtext}</p>
      </div>
    </main>
  );
}
