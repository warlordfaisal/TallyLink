import { ArrowRight, Boxes, CircleDollarSign, HandCoins, RefreshCw, Search, ShoppingBag, Sparkles, Wallet, X, BookOpen, ClipboardList } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Summary = {
  stockItems: Array<{ name: string; quantity: string }>;
  receivables: number;
  payables: number;
  salesEntriesToday: number;
  purchaseEntriesToday: number;
  paymentEntriesToday: number;
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const cards = [
  { key: "stockItems", title: "Stock on hand", note: "Item quantities · View full list", icon: Boxes, tone: "violet" },
  { key: "receivables", title: "Receivables", note: "Net closing balance from customers", icon: HandCoins, tone: "emerald" },
  { key: "payables", title: "Payables", note: "Net closing balance to suppliers", icon: Wallet, tone: "amber" },
  { key: "salesEntriesToday", title: "Sales entries today", note: "Sales voucher total", icon: ShoppingBag, tone: "blue" },
  { key: "purchaseEntriesToday", title: "Purchase entries today", note: "Purchase voucher total", icon: Boxes, tone: "amber" },
  { key: "paymentEntriesToday", title: "Payment entries today", note: "Payment voucher total", icon: CircleDollarSign, tone: "teal" },
] as const;

export default function DashboardSummary({ company, port, connected, onOpenSales, onOpenDayBook, onOpenOrders }: { company: string; port: number; connected: boolean; onOpenSales: () => void; onOpenDayBook: () => void; onOpenOrders: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [error, setError] = useState("");
  const [updateModal, setUpdateModal] = useState<string | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const requestRef = useRef(0);

  const refresh = async () => {
    if (!company || !connected) return;
    const requestId = ++requestRef.current;
    setStatus("loading");
    setSummary(null);
    setError("");
    try {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const result = await window.desktop.fetchDashboardSummary({ company, port, date });
      if (requestId !== requestRef.current) return;
      if (!result.ok) throw new Error(result.error || "Tally could not return the dashboard totals.");
      setSummary({
        stockItems: result.stockItems ?? [],
        receivables: result.receivables ?? 0,
        payables: result.payables ?? 0,
        salesEntriesToday: result.salesEntriesToday ?? 0,
        purchaseEntriesToday: result.purchaseEntriesToday ?? 0,
        paymentEntriesToday: result.paymentEntriesToday ?? 0,
      });
      setStatus("loaded");
    } catch (cause) {
      if (requestId !== requestRef.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  };

  useEffect(() => {
    setSummary(null);
    setUpdateModal(null);
    if (connected && company) void refresh();
    else setStatus("idle");
    return () => { requestRef.current += 1; };
  }, [company, port, connected]);

  const filteredStockItems = useMemo(() => (summary?.stockItems ?? []).filter((item) =>
    item.name.toLocaleLowerCase().includes(stockSearch.toLocaleLowerCase().trim()),
  ), [summary?.stockItems, stockSearch]);

  return <>
  <section className="report-screen animate-[rise-in_.35s_ease-out_both]">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="section-kicker">BUSINESS SNAPSHOT</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-[-0.04em] text-slate-900">Overview</h1>
        <p className="mt-1 text-[12px] text-slate-600">Key balances and today’s activity for {company || "your Tally company"}.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={!connected || status === "loading"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50">
        <RefreshCw size={14} className={status === "loading" ? "animate-spin" : ""}/>{status === "loading" ? "Refreshing…" : "Refresh totals"}
      </button>
    </div>

    {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800">Couldn’t load the business snapshot: {error}</div>}
    {!connected && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">Connect to Tally to load your business totals.</div>}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map(({ key, title, note, icon: Icon, tone }) => {
        const isStockCard = key === "stockItems";
        const value = isStockCard ? undefined : summary?.[key as Exclude<keyof Summary, "stockItems">];
        const toneClass = tone === "violet" ? "bg-violet-50 text-violet-700 ring-violet-100" : tone === "emerald" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : tone === "amber" ? "bg-amber-50 text-amber-700 ring-amber-100" : tone === "blue" ? "bg-blue-50 text-blue-700 ring-blue-100" : "bg-teal-50 text-teal-700 ring-teal-100";
        return <button key={key} type="button" onClick={() => isStockCard ? setStockModalOpen(true) : setUpdateModal(title)} aria-expanded={isStockCard ? stockModalOpen : undefined} className="group min-h-[150px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
          <span className="flex items-start justify-between">
            <span className="text-[12px] font-semibold text-slate-600">{title}</span>
            <span className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${toneClass}`}><Icon size={17}/></span>
          </span>
          <span className="mt-3 block truncate text-[22px] font-bold tracking-tight text-slate-950">{status === "loading" ? <span className="inline-block h-6 w-28 animate-pulse rounded bg-slate-100 align-middle"/> : isStockCard ? `${summary?.stockItems.length ?? 0} items` : value === undefined ? "—" : money.format(value)}</span>
          {isStockCard ? <span className="mt-1 block space-y-1 text-[10px] text-slate-500">{(summary?.stockItems ?? []).slice(0, 3).map((item) => <span key={item.name} className="flex justify-between gap-2"><span className="truncate">{item.name}</span><span className="shrink-0 font-semibold text-slate-700">{item.quantity || "—"}</span></span>)}{!summary?.stockItems.length && <span>{status === "loading" ? "Loading stock items…" : "No stock items returned"}</span>}<span className="block pt-1 font-semibold text-indigo-600">Click to open full list</span></span> : <span className="mt-1 block text-[10px] text-slate-500">{note}</span>}
        </button>;
      })}
    </div>

    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><div className="section-kicker">JUMP BACK IN</div><div className="mt-0.5 text-[13px] font-bold text-slate-900">Quick access</div></div><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><ArrowRight size={15}/></span></div>
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        {[{ title: "Sales & collections", detail: "Track invoices and receipts", icon: CircleDollarSign, action: onOpenSales, tone: "text-indigo-600 bg-indigo-50" }, { title: "Day Book", detail: "Review today’s activity", icon: BookOpen, action: onOpenDayBook, tone: "text-teal-700 bg-teal-50" }, { title: "Orders", detail: "Check open and closed orders", icon: ClipboardList, action: onOpenOrders, tone: "text-amber-700 bg-amber-50" }].map(({ title, detail, icon: Icon, action, tone }) => <button key={title} type="button" onClick={action} className="group flex min-w-0 items-center gap-3 rounded-xl border border-transparent bg-slate-50/80 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-white hover:shadow-md"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-slate-800">{title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{detail}</span></span><ArrowRight size={14} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600"/></button>)}
      </div>
    </div>
  </section>
  {updateModal && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUpdateModal(null); }} onKeyDown={(event) => { if (event.key === "Escape") setUpdateModal(null); }} className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm animate-[overlay-in_.18s_ease-out_both]">
    <section role="dialog" aria-modal="true" aria-labelledby="update-modal-title" className="relative w-full max-w-[420px] overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,.32)] animate-[dialog-in_.28s_cubic-bezier(.2,.8,.2,1)_both]">
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 px-6 pb-7 pt-6 text-white"><div className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10 blur-2xl"/><div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl"/><button type="button" aria-label="Close" onClick={() => setUpdateModal(null)} className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"><X size={16}/></button><div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-white/15 shadow-lg shadow-indigo-950/10"><Sparkles size={24} className="animate-[float_2.8s_ease-in-out_infinite]"/></div><div className="relative mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-indigo-100">Coming soon</div><h2 id="update-modal-title" className="relative mt-1 text-[23px] font-bold tracking-tight">More insight is on the way</h2><p className="relative mt-2 max-w-[330px] text-[12px] leading-5 text-indigo-100">{updateModal} details are being prepared for a future update or higher plan.</p></div>
      <div className="p-5"><div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-indigo-600 shadow-sm"><Sparkles size={14}/></span><div><div className="text-[12px] font-bold text-slate-800">A little more patience</div><p className="mt-1 text-[11px] leading-5 text-slate-600">Wait for an update or explore a higher plan to unlock this feature.</p></div></div></div><button type="button" onClick={() => setUpdateModal(null)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[12px] font-bold text-white transition hover:bg-indigo-700">Sounds good <ArrowRight size={14}/></button></div>
    </section>
  </div>}
  {stockModalOpen && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStockModalOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setStockModalOpen(false); }} className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
    <section role="dialog" aria-modal="true" aria-labelledby="stock-modal-title" className="flex max-h-[min(780px,90vh)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div><div className="section-kicker">INVENTORY</div><h2 id="stock-modal-title" className="mt-1 text-[18px] font-bold text-slate-900">Stock on hand</h2><p className="mt-1 text-[11px] text-slate-500">{summary?.stockItems.length ?? 0} stock items · closing quantities as of today</p></div>
        <button type="button" aria-label="Close stock list" onClick={() => setStockModalOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X size={17}/></button>
      </div>
      <div className="border-b border-slate-100 p-4"><label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3"><Search size={14} className="text-slate-400"/><input autoFocus value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} placeholder="Search stock items" className="w-full bg-transparent text-[12px] text-slate-800 outline-none"/></label></div>
      <div className="min-h-0 flex-1 overflow-auto">
        {!filteredStockItems.length ? <div className="p-10 text-center text-[13px] text-slate-500">{stockSearch ? "No stock items match your search." : "No stock items were returned by Tally."}</div> : <table className="w-full text-left text-[12px]"><thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Stock item</th><th className="px-5 py-3 text-right">Closing quantity</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredStockItems.map((item, index) => <tr key={`${item.name}-${index}`} className="text-slate-700 hover:bg-indigo-50/40"><td className="px-5 py-3 font-medium text-slate-900">{item.name}</td><td className="px-5 py-3 text-right font-semibold tabular-nums">{item.quantity || "—"}</td></tr>)}</tbody></table>}
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3"><button type="button" onClick={() => setStockModalOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50">Close</button></div>
    </section>
  </div>}
  </>;
}
