import Link from "next/link";

// One shared nav-link row, rendered right under the header by all 4
// templates — same tradeoff CategoriesSection/BundlesSection already make
// (a single consistent design, not 4 bespoke per-template looks), since
// this is a simple link list, not a showcase element. Returns null when
// the merchant hasn't configured any links, same pattern every other
// optional storefront block uses.
export function StorefrontNavRow({
  navMenuItems,
  primaryColor,
}: {
  navMenuItems: { id: string; label: string; url: string }[];
  primaryColor: string;
}) {
  if (navMenuItems.length === 0) return null;

  return (
    <nav className="bg-white border-b border-harbor/10 overflow-x-auto">
      <div className="mx-auto max-w-6xl px-6 flex items-center gap-6 whitespace-nowrap">
        {navMenuItems.map((item) => (
          <Link
            key={item.id}
            href={item.url}
            className="py-3 text-sm font-bold text-harbor/80 hover:opacity-80 transition-opacity"
            style={{ color: primaryColor }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
