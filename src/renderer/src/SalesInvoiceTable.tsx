import { Fragment, useState } from "react";
import { RefreshCw } from "lucide-react";

type SalesRow = {
  date: string;
  number: string;
  amount: number;
  received: number;
  balance: number;
  voucherType?: string;
  items?: Array<{ name: string; quantity: string }>;
};

const pageSize = 50;
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};
const daysSince = (value: string) => {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const voucherDay = Date.parse(`${value}T00:00:00Z`);
  const todayDay = Date.parse(`${todayIso}T00:00:00Z`);
  return Number.isFinite(voucherDay)
    ? Math.max(0, Math.floor((todayDay - voucherDay) / 86_400_000))
    : "—";
};
const uniqueItems = (items: SalesRow["items"]) => {
  const seen = new Set<string>();
  return (items ?? []).filter((item) => {
    const key = `${item.name.trim().toLocaleLowerCase()}|${item.quantity.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function SalesInvoiceTable({
  rows,
  fromDate,
  toDate,
  party,
  maxDate,
  onFromDateChange,
  onToDateChange,
  onRefresh,
  showSettled,
  settledCount,
  onToggleSettled,
  isLoading,
  loadError,
  emptyMessage,
}: {
  rows: SalesRow[];
  fromDate: string;
  toDate: string;
  party: string;
  maxDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onRefresh: () => void;
  showSettled: boolean;
  settledCount: number;
  onToggleSettled: () => void;
  isLoading: boolean;
  loadError: string;
  emptyMessage: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">
            Party ledger
          </div>
          <h2 className="mt-0.5 truncate text-[16px] font-bold text-slate-950">
            {party}
          </h2>
          <div className="mt-0.5 text-[10px] text-slate-500">
            Open receivables include older bills. All entries use this ledger’s debit/credit movements for the selected dates.
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-1.5">
          <label className="grid gap-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => onFromDateChange(event.target.value)}
              className="h-8 w-[116px] rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-400"
            />
          </label>
          <label className="grid gap-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={maxDate}
              onChange={(event) => onToDateChange(event.target.value)}
              className="h-8 w-[116px] rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-400"
            />
          </label>
          <button
            type="button"
            title="Refresh report"
            aria-label="Refresh report"
            onClick={onRefresh}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-indigo-700 transition hover:bg-indigo-50"
          >
            <RefreshCw size={14} />
          </button>
          {party && (
            <button
              type="button"
              role="switch"
              aria-label="Show this party's ledger debit and credit entries"
              aria-checked={showSettled}
              onClick={onToggleSettled}
              disabled={isLoading}
              className="group flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-70"
              title="Fetch this party's debit and credit ledger entries for the selected dates"
            >
              <span>{isLoading ? "Loading…" : "All entries"}</span>
              <span
                  className={`relative block h-5 w-9 shrink-0 rounded-full border transition-colors ${showSettled ? "border-indigo-700 bg-indigo-600" : "border-slate-400 bg-slate-300"}`}
              >
                <span
                  className={`absolute left-[2px] top-[2px] h-3.5 w-3.5 rounded-full border border-slate-300 bg-white shadow transition-transform duration-200 ease-out ${showSettled ? "translate-x-4" : "translate-x-0"}`}
                />
              </span>
              {settledCount > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] tabular-nums text-slate-600">
                  {settledCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      {(loadError || (isLoading && !showSettled)) && (
        <div className="border-b border-slate-100 px-4 py-2 text-[11px]">
          {loadError ? (
            <span className="text-rose-700">{loadError}</span>
          ) : (
            <span className="text-indigo-700">Fetching data for this party…</span>
          )}
        </div>
      )}
      <div className="max-h-[60vh] overflow-auto">
        <table className="min-w-[600px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-[12px] font-bold uppercase tracking-[0.06em] text-slate-600">
            <tr>
              <th className="px-4 py-3.5">Date</th>
              <th className="px-3 py-3.5">Items / Qty</th>
              <th className="px-3 py-3.5">Voucher no.</th>
              <th className="px-3 py-3.5 text-right">{showSettled ? "Debit" : "Sales"}</th>
              <th className="px-3 py-3.5 text-right">{showSettled ? "Credit" : "Received"}</th>
              <th className="px-4 py-3.5 text-right">Balance</th>
              <th className="max-[1279px]:hidden px-4 py-3.5 text-right">
                Days passed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[14px]">
            {visibleRows.map((row, index) => (
              <Fragment key={`${row.number}-${row.date}-${page}-${index}`}>
              <tr
                key={`${row.number}-${row.date}-${page}-${index}`}
                className="transition hover:bg-indigo-50/45"
              >
                <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                  {formatDate(row.date)}
                </td>
                <td className="max-w-[220px] px-3 py-2.5 text-[11px] leading-4 text-slate-700">
                  {uniqueItems(row.items).length ? (
                    <div className="space-y-1">
                      {uniqueItems(row.items).map((item, itemIndex) => (
                        <div
                          key={`${item.name}-${itemIndex}`}
                          className="min-w-0"
                        >
                          <span
                            className="block truncate font-semibold"
                            title={item.name}
                          >
                            {item.name || "Item"}
                          </span>
                          <span className="block whitespace-nowrap text-slate-500">
                            {item.quantity || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 font-bold text-slate-900">
                  <span>{row.number || "—"}</span>
                  {showSettled && row.voucherType && <span className="mt-0.5 block text-[10px] font-medium text-slate-500">{row.voucherType}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-slate-900">
                  {money.format(row.amount)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-emerald-800">
                  {money.format(row.received)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums text-slate-950">
                  {money.format(row.balance)}
                </td>
                <td className="max-[1279px]:hidden whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-slate-600">
                  {daysSince(row.date)}
                </td>
              </tr>
              </Fragment>
            ))}
            {rows.length === 0 && !isLoading && !loadError && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="text-[15px] font-semibold text-slate-800">
                    {emptyMessage}
                  </div>
                  <div className="mt-1 text-[13px] text-slate-600">
                    Choose another date range or party ledger.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[12px] text-slate-600">
          <span>
            Showing {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, rows.length)} of{" "}
            {rows.length.toLocaleString("en-IN")} Invoices
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              {page + 1} / {pageCount}
            </span>
            <button
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
