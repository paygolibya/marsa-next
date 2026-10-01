"use client";

import { useMemo, useState } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  // Used for both sorting and the default cell render (when render isn't
  // given) — numeric values sort numerically, everything else sorts as
  // Arabic-aware text.
  accessor?: (row: T) => string | number;
  sortable?: boolean;
  align?: "start" | "end" | "center";
};

// Generic client-side search/sort/pagination table — no server-side paging
// needed, list volumes here are per-merchant, not platform-wide. Replaces
// the raw <table> markup previously hand-written per dashboard page.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = "بحث...",
  searchText,
  pageSize = 10,
  emptyState,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  // Combined searchable text for a row — omit to hide the search box entirely.
  searchText?: (row: T) => string;
  pageSize?: number;
  emptyState?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchText) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchText(r).toLowerCase().includes(q));
  }, [rows, query, searchText]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.accessor) return filtered;
    const accessor = col.accessor;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function alignClass(align: DataTableColumn<T>["align"]) {
    return align === "end" ? "text-left" : align === "center" ? "text-center" : "text-right";
  }

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div>
      {searchText && (
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="input mb-4 max-w-sm"
        />
      )}

      {sorted.length === 0 ? (
        <p className="text-rope text-sm py-10 text-center">لا توجد نتائج مطابقة</p>
      ) : (
        <>
          {/* Mobile: one card per row instead of the real <table> below —
              a 6+ column table crammed into a phone-width screen forced
              horizontal scroll with no visible affordance and columns
              cut off at the edge, confirmed live across the orders,
              payouts, and admin-escalations pages that all share this
              component. Sorting (header click) has no mobile equivalent
              here — search still works, which covers the common case;
              not adding a mobile sort-by control is a deliberate scope
              cut, not an oversight. */}
          <div className="sm:hidden space-y-3">
            {pageRows.map((row) => {
              const labeled = columns.filter((c) => c.header);
              const unlabeled = columns.filter((c) => !c.header);
              return (
                <div key={rowKey(row)} className="rounded-2xl border border-harbor/10 bg-white p-4 shadow-sm space-y-2">
                  {labeled.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-rope shrink-0">{col.header}</span>
                      <span className="text-harbor font-bold text-left min-w-0">
                        {col.render ? col.render(row) : col.accessor ? String(col.accessor(row)) : ""}
                      </span>
                    </div>
                  ))}
                  {unlabeled.length > 0 && (
                    // justify-start, not -end: in this RTL layout
                    // justify-end packs toward the LEFT edge — exactly
                    // where the fixed support-chat button sits, confirmed
                    // live covering the "استرداد" action on the orders
                    // page. justify-start keeps it on the right.
                    <div className="pt-2 mt-1 border-t border-harbor/10 flex items-center justify-start gap-3">
                      {unlabeled.map((col) => (
                        <span key={col.key}>{col.render ? col.render(row) : null}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-harbor/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-harbor/5 border-b border-harbor/10">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      className={`px-4 py-3 font-bold text-harbor whitespace-nowrap ${alignClass(col.align)} ${
                        col.sortable ? "cursor-pointer select-none" : ""
                      }`}
                    >
                      {col.header}
                      {col.sortable && sortKey === col.key && (sortDir === "asc" ? " ▲" : " ▼")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-harbor/5 last:border-0 hover:bg-harbor/5">
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 text-harbor/90 ${alignClass(col.align)}`}>
                        {col.render ? col.render(row) : (col.accessor ? String(col.accessor(row)) : "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-rope">
              <span>
                صفحة {clampedPage} من {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={clampedPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-full border border-harbor/20 px-3 py-1 disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-harbor/20 px-3 py-1 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
