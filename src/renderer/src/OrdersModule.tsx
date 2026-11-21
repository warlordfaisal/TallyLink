import { ArrowDownToLine, ChevronLeft, ChevronRight, ClipboardList, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type OrderItem = { name: string; ordered: string; fulfilled: string; remaining: string };
type OrderRow = { date: string; number: string; party: string; reference: string; isPreClosed: boolean; items: OrderItem[] };
const PAGE_SIZE = 20;

function fuzzyScore(query: string, candidate: string) {
  const q = query.toLocaleLowerCase().trim();
  const text = candidate.toLocaleLowerCase();
  if (!q) return 0;
  if (text === q) return 1000;
  if (text.startsWith(q)) return 800 - (text.length - q.length);
  if (text.split(/\s+/).some((word) => word.startsWith(q))) return 650 - text.length * 0.1;
  let cursor = 0;
  for (const char of q) {
    cursor = text.indexOf(char, cursor);
    if (cursor < 0) return -1;
    cursor += 1;
  }
  return 350 - (text.length - q.length) * 2;
}

function quantityNumber(value: string) {
  const parsed = Number(value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOrderStatus(row: OrderRow) {
  if (row.isPreClosed) return "Closed";
  const values = row.items.map((item) => quantityNumber(item.remaining));
  if (values.length && values.every((value) => value === 0)) return "Closed";
  if (values.some((value) => value !== null && value > 0)) return "Open";
  return "Status unavailable";
}

export default function OrdersModule({ company, port }: { company: string; port: number }) {
  const [kind, setKind] = useState<"sales" | "purchase">("sales");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [partySearch, setPartySearch] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setRows([]);
    void window.desktop.fetchOrders({ company, port, party: "", kind })
      .then((result) => {
        if (!current) return;
        if (!result.ok) throw new Error(result.error || "Could not load orders from Tally.");
        setRows(result.rows ?? []);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [company, port, kind, reloadKey]);

  const statusFilteredRows = useMemo(() => statusFilter === "all"
    ? rows
    : rows.filter((row) => getOrderStatus(row).toLocaleLowerCase() === statusFilter),
  [rows, statusFilter]);
  const matchingRows = useMemo(() => {
    const query = partySearch.trim();
    return query ? statusFilteredRows.filter((row) => fuzzyScore(query, row.party) >= 0) : statusFilteredRows;
  }, [statusFilteredRows, partySearch]);
  const displayRows = useMemo(() => matchingRows.flatMap((order) =>
    (order.items.length ? order.items : [{ name: "—", ordered: "", fulfilled: "", remaining: "" }])
      .map((item) => ({ order, item })),
  ), [matchingRows]);
  const pageCount = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pageRows = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [partySearch, kind, statusFilter]);

  return <section className="report-screen">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="section-kicker">TALLY REPORT</div><h1 className="mt-1 text-[22px] font-bold tracking-[-0.035em] text-slate-900">Orders</h1><p className="mt-1 text-[12px] text-slate-600">All {kind} orders load automatically. Search by party to narrow the list.</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Search party
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2"><Search size={14} className="shrink-0 text-slate-400"/><input value={partySearch} onChange={(event) => setPartySearch(event.target.value)} placeholder="Fuzzy search party" className="w-56 bg-transparent text-[12px] font-semibold normal-case tracking-normal text-slate-900 outline-none" /></div>
        </label>
        <button type="button" disabled={loading || !company} onClick={() => { setPage(1); setReloadKey((key) => key + 1); }} className="connect-action inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white disabled:opacity-60"><ArrowDownToLine size={14}/>{loading ? "Loading…" : "Refresh"}</button>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Order type" className="relative inline-grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <span aria-hidden="true" className={`absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${kind === "purchase" ? "translate-x-full" : "translate-x-0"}`} />
        {([["sales", "Sales Orders"], ["purchase", "Purchase Orders"]] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={kind === value} onClick={() => { setKind(value); setPartySearch(""); }} className={`relative z-10 rounded-lg px-4 py-2 text-[12px] font-bold transition-colors duration-200 ${kind === value ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>)}
      </div>
      <div role="group" aria-label="Filter orders by status" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {([["all", "All"], ["open", "Open"], ["closed", "Closed"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={`rounded-lg px-3 py-2 text-[12px] font-bold transition-colors ${statusFilter === value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>{label}</button>)}
      </div>
    </div>

    {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-900">{error}</div>}
    {loading && <div role="status" className="mt-4 rounded-xl border border-indigo-100 bg-white p-5 text-[13px] text-slate-600"><span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600 align-[-2px]"/>Loading all {kind} orders from Tally…</div>}
    {!loading && !error && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div className="text-[13px] font-bold text-slate-900">{kind === "sales" ? "Sales Orders" : "Purchase Orders"}<span className="ml-2 text-[11px] font-semibold text-slate-500">{matchingRows.length.toLocaleString("en-IN")} matching orders</span></div><div className="text-[11px] text-slate-500">Showing every order returned by Tally.</div></div>
      {!pageRows.length ? <div className="p-10 text-center text-[13px] text-slate-500">{partySearch ? "No orders match that party search." : statusFilter !== "all" ? `No ${statusFilter} ${kind} orders returned for this company.` : `No ${kind} orders returned for this company.`}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[12px]"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Ordered</th><th className="px-4 py-3 text-right">Delivered / received</th><th className="px-4 py-3 text-right">Remaining</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{pageRows.map(({ order, item }, rowIndex) => <tr key={`${order.number}-${rowIndex}`} className="text-slate-700"><td className="whitespace-nowrap px-4 py-3">{order.date || "—"}</td><td className="px-4 py-3 font-semibold text-slate-900">{order.reference || order.number || "—"}</td><td className="max-w-[220px] truncate px-4 py-3">{order.party || "—"}</td><td className="max-w-[280px] truncate px-4 py-3">{item.name}</td><td className="px-4 py-3 text-right tabular-nums">{item.ordered || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{item.fulfilled || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{item.remaining || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${getOrderStatus(order) === "Open" ? "bg-emerald-50 text-emerald-700" : getOrderStatus(order) === "Status unavailable" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{getOrderStatus(order)}</span></td></tr>)}</tbody></table></div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><div className="text-[11px] text-slate-500">{matchingRows.length.toLocaleString("en-IN")} orders · {PAGE_SIZE} rows per page <span className="ml-2">Page {Math.min(page, pageCount)} of {pageCount}</span></div><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14}/>Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next<ChevronRight size={14}/></button></div></div>
    </div>}
  </section>;
}
