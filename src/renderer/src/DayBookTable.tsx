import { useEffect, useState } from "react";

type DayBookSale = {
  date: string;
  party: string;
  amount: number;
  items: Array<{ name: string; quantity: string }>;
};
type DayBookPayment = { date: string; party: string; amount: number };

const pageSize = 100;
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
}: {
  count: number;
  page: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-600">
      <span>
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)}{" "}
        of {count.toLocaleString("en-IN")}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function DayBookTable({
  sales,
  payments,
}: {
  sales: DayBookSale[];
  payments: DayBookPayment[];
}) {
  const [activeSection, setActiveSection] = useState<"sales" | "payments">("sales");
  const [salesPage, setSalesPage] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(0);
  useEffect(() => {
    setSalesPage(0);
    setPaymentsPage(0);
  }, [sales, payments]);

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
      <div role="tablist" aria-label="Day Book voucher type" className="relative mb-3 grid w-fit grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <span aria-hidden="true" className={`absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-out ${activeSection === "payments" ? "translate-x-full" : "translate-x-0"}`} />
        <button type="button" role="tab" aria-selected={activeSection === "sales"} onClick={() => setActiveSection("sales")} className={`relative z-[1] rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors duration-200 ${activeSection === "sales" ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>
          Sales <span className={`ml-1.5 tabular-nums ${activeSection === "sales" ? "text-indigo-100" : "text-slate-400"}`}>{sales.length.toLocaleString("en-IN")}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeSection === "payments"} onClick={() => setActiveSection("payments")} className={`relative z-[1] rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors duration-200 ${activeSection === "payments" ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>
          Payments <span className={`ml-1.5 tabular-nums ${activeSection === "payments" ? "text-indigo-100" : "text-slate-400"}`}>{payments.length.toLocaleString("en-IN")}</span>
        </button>
      </div>
      {activeSection === "sales" && (
      <section key="sales-daybook" className="min-w-0 animate-[rise-in_.2s_ease-out_both] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-[14px] font-bold text-slate-900">Sales</h2>
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800">
            {sales.length.toLocaleString("en-IN")}
          </span>
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
        <Pager count={sales.length} page={salesPage} onChange={setSalesPage} />
      </section>
      )}
      {activeSection === "payments" && (
      <section key="payments-daybook" className="min-w-0 animate-[rise-in_.2s_ease-out_both] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-[14px] font-bold text-slate-900">Payments</h2>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            {payments.length.toLocaleString("en-IN")}
          </span>
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
        />
      </section>
      )}
    </div>
  );
}
