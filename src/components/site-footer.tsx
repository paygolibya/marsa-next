import Image from "next/image";

// The `store` prop is what makes footerStyle "branded" actually different
// from "standard" — previously this component took no props at all, so a
// merchant's own store footer was indistinguishable from Rifqa's own
// platform pages, regardless of what footerStyle was saved.
export function SiteFooter({ store }: { store?: { name: string; tagline?: string | null } } = {}) {
  return (
    <footer className="border-t border-harbor/10 bg-harbor text-canvas/70">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {store && (
          <div className="mb-6 pb-6 border-b border-canvas/10 text-center">
            <p className="font-display text-lg font-extrabold text-canvas">{store.name}</p>
            {store.tagline && <p className="text-sm mt-1">{store.tagline}</p>}
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="رفقة" width={28} height={28} className="h-7 w-7 object-contain" />
            <span>رفقة — منتج من مرسى (Marsa)</span>
          </div>
          <p>صُنعت في طرابلس، لتجار ليبيا. © {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
