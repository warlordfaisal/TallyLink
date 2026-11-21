import { useState } from "react";

type DayBookSale = {
  date: string;
  party: string;
  amount: number;
  items: Array<{ name: string; quantity: string }>;
};
type DayBookPayment = { date: string; party: string; amount: number };

const pageSize = 50;
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const dateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};

function Pager({
  count,
  page,
  onChange,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  count: number;
  page: number;
  onChange: (page: number) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const loadedPages = Math.max(1, Math.ceil(count / pageSize));
  const hasLoadedNextPage = page + 1 < loadedPages;
  const firstPageButton = Math.max(0, Math.min(page - 4, loadedPages - 10));
  const visiblePages = Array.from(
    { length: Math.min(10, loadedPages) },
    (_unused, index) => firstPageButton + index,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-600">
      <span>Page {page + 1} of {loadedPages}{hasMore ? "+" : ""}</span>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
        >
          Previous
        </button>
        {visiblePages.map((pageIndex) => <button
          key={pageIndex}
          type="button"
          aria-current={pageIndex === page ? "page" : undefined}
          onClick={() => onChange(pageIndex)}
          className={`min-w-8 rounded-md border px-2.5 py-1.5 font-semibold ${pageIndex === page ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 hover:bg-slate-50"}`}
        >{pageIndex + 1}</button>)}
        {loadedPages > firstPageButton + visiblePages.length && <span className="px-1">…</span>}
        <button
          type="button"
          disabled={loadingMore || (!hasLoadedNextPage && !hasMore)}
          onClick={() => {
            if (hasLoadedNextPage) onChange(page + 1);
            else if (hasMore) onLoadMore();
          }}
          className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
        >
          {loadingMore ? "Loading…" : "Next"}
        </button>
      </div>
    </div>
  );
}

export default function DayBookTable({
  sales,
  payments,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  sales: DayBookSale[];
  payments: DayBookPayment[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const [activeSection, setActiveSection] = useState<"sales" | "payments">("sales");
  const [salesPage, setSalesPage] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const visibleSales = sales.slice(
    salesPage * pageSize,
    (salesPage + 1) * pageSize,
  );
  const visiblePayments = payments.slice(
    paymentsPage * pageSize,
    (paymentsPage + 1) * pageSize,
  );
  return (
    <div className="mt-4 min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Day Book voucher type" className="relative grid w-fit grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <span aria-hidden="true" className={`absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-out ${activeSection === "payments" ? "translate-x-full" : "translate-x-0"}`} />
          <button type="button" role="tab" aria-selected={activeSection === "sales"} onClick={() => setActiveSection("sales")} className={`relative z-[1] rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors duration-200 ${activeSection === "sales" ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>
            Sales
          </button>
          <button type="button" role="tab" aria-selected={activeSection === "payments"} onClick={() => setActiveSection("payments")} className={`relative z-[1] rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors duration-200 ${activeSection === "payments" ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>
            Payments
          </button>
        </div>
        {loadingMore && <span role="status" className="text-[11px] text-slate-600">Loading more…</span>}
      </div>
      {activeSection === "sales" && (
      <section key="sales-daybook" className="min-w-0 animate-[rise-in_.2s_ease-out_both] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-[14px] font-bold text-slate-900">Sales</h2>
        </div>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Party name</th>
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSales.map((sale, index) => (
                <tr
                  key={`${sale.date}-${sale.party}-${index}`}
                  className="align-top hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {dateLabel(sale.date)}
                  </td>
                  <td className="max-w-[180px] px-3 py-3 font-semibold text-slate-800">
                    <span className="block truncate" title={sale.party}>
                      {sale.party || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] leading-4 text-slate-700">
                    {sale.items.length ? (
                      sale.items.map((item, itemIndex) => (
                        <div
                          key={`${item.name}-${itemIndex}`}
                          className="mb-1 last:mb-0"
                        >
                          <span className="block font-medium">
                            {item.name || "—"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] leading-4 tabular-nums text-slate-600">
                    {sale.items.length
                      ? sale.items.map((item, itemIndex) => (
                          <span
                            key={`${item.name}-qty-${itemIndex}`}
                            className="mb-1 block last:mb-0"
                          >
                            {item.quantity || "—"}
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {money.format(sale.amount)}
                  </td>
                </tr>
              ))}
              {!sales.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No sales in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager count={sales.length} page={salesPage} onChange={setSalesPage} hasMore={hasMore} loadingMore={loadingMore} onLoadMore={onLoadMore} />
      </section>
      )}
      {activeSection === "payments" && (
      <section key="payments-daybook" className="min-w-0 animate-[rise-in_.2s_ease-out_both] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-[14px] font-bold text-slate-900">Payments</h2>
        </div>
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Party name</th>
                <th className="px-3 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiblePayments.map((payment, index) => (
                <tr
                  key={`${payment.date}-${payment.party}-${index}`}
                  className="hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {dateLabel(payment.date)}
                  </td>
                  <td className="max-w-[220px] px-3 py-3 font-semibold text-slate-800">
                    <span className="block truncate" title={payment.party}>
                      {payment.party || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {money.format(payment.amount)}
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No payments in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager
          count={payments.length}
          page={paymentsPage}
          onChange={setPaymentsPage}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
        />
      </section>
      )}
    </div>
  );
}
