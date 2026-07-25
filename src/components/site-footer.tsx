export function SiteFooter() {
  return (
    <footer className="border-t border-harbor/10 bg-harbor text-canvas/70">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="stamp h-7 w-7 border-canvas/40 text-canvas/70 text-[10px] font-bold">م</span>
          <span>رفقة — منتج من مرسى (Marsa)</span>
        </div>
        <p>صُنعت في طرابلس، لتجار ليبيا. © {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
