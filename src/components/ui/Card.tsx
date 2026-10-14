// The `rounded-2xl border border-harbor/10 bg-white shadow-sm` shell
// repeated ad hoc across every dashboard page (analytics stat tiles,
// payouts, products, coupons) — centralized here. No default padding:
// callers already vary it (p-4/p-6/p-8) per context, so it's left to the
// caller via className rather than baked in and fought against.
//
// `elevation-card` is the one shared resting shadow (see globals.css) so
// every card sits at the same depth instead of each page picking its own.
export function Card({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-harbor/10 bg-white elevation-card ${className}`} {...rest} />;
}
