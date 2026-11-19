import { ArrowDownToLine, ClipboardList, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type OrderItem = { name: string; ordered: string; fulfilled: string; remaining: string };
type OrderRow = { date: string; number: string; party: string; reference: string; isPreClosed: boolean; items: OrderItem[] };

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

export default function OrdersModule({ company, port }: { company: string; port: number }) {
  const [kind, setKind] = useState<"sales" | "purchase">("sales");
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [party, setParty] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [partyCache, setPartyCache] = useState<Record<string, string[]>>({});

  const loadOrders = async (partyValue = selectedParty) => {
    const selected = partyValue.trim();
    if (!selected) { setError("Enter the exact party ledger name from Tally first."); return; }
    setLoading(true); setError(""); setRows([]); setLoadedFor("");
    try {
      const result = await window.desktop.fetchOrders({ company, port, party: selected, kind });
      if (!result.ok) throw new Error(result.error || "Could not load orders from Tally.");
      setRows(result.rows ?? []);
      setLoadedFor(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setLoading(false); }
  };

  const suggestionKey = `${company}|${port}|${kind}|${status}`;
  useEffect(() => {
    if (!suggestionsOpen || !party.trim()) { setSuggestions([]); setSuggestionsLoading(false); return; }
    const cached = partyCache[suggestionKey];
    if (cached) { setSuggestions(cached); setSuggestionsLoading(false); return; }
    let current = true;
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true);
      void window.desktop.fetchOrderParties({ company, port, kind, status }).then((result) => {
        if (!current) return;
        if (!result.ok) throw new Error(result.error || "Could not find party ledgers in Tally.");
        const parties = result.parties ?? [];
        setPartyCache((cache) => ({ ...cache, [suggestionKey]: parties }));
        setSuggestions(parties);
      }).catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      }).finally(() => { if (current) setSuggestionsLoading(false); });
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [suggestionsOpen, party, company, port, kind, status, suggestionKey, partyCache]);

  const matchingParties = useMemo(() => suggestions
    .map((name) => ({ name, score: fuzzyScore(party, name) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 8), [suggestions, party]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    const remainingValues = row.items.map((item) => {
      const remaining = quantityNumber(item.remaining);
      return remaining;
    });
    const hasPending = remainingValues.some((remaining) => remaining !== null && remaining > 0);
    const isClosed = row.isPreClosed || (remainingValues.length > 0 && remainingValues.every((remaining) => remaining === 0));
    // Pre-closed orders are intentionally classified as closed, never as liability.
    // Only call an order open when Tally supplied a positive remaining quantity.
    // If status fields are absent, keep it visible in All with an explicit unknown label.
    if (status === "open") return !isClosed && hasPending;
    if (status === "closed") return isClosed;
    return true;
  }), [rows, status]);

  const getRowStatus = (row: OrderRow) => {
    if (row.isPreClosed) return "Pre-closed";
    const values = row.items.map((item) => quantityNumber(item.remaining));
    if (values.length && values.every((value) => value === 0)) return "Closed";
    if (values.some((value) => value !== null && value > 0)) return "Open";
    return "Status unavailable";
  };

  return <section className="report-screen">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="section-kicker">TALLY REPORT</div><h1 className="mt-1 text-[22px] font-bold tracking-[-0.035em] text-slate-900">Orders</h1><p className="mt-1 text-[12px] text-slate-600">Load orders for one party at a time. Nothing is fetched until you request it.</p></div>
      <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <label className="relative grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Party ledger
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2"><Search size={14} className="shrink-0 text-slate-400"/><input value={party} onFocus={() => setSuggestionsOpen(true)} onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 140)} onChange={(e) => { setParty(e.target.value); setSelectedParty(""); setError(""); setSuggestionsOpen(true); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matchingParties[0]) { setParty(matchingParties[0].name); setSelectedParty(matchingParties[0].name); setSuggestionsOpen(false); void loadOrders(matchingParties[0].name); } else if (!suggestionsLoading) setError(`No matching party with ${status} ${kind} orders.`); } if (e.key === "Escape") setSuggestionsOpen(false); }} placeholder="Search party ledger" className="w-56 bg-transparent text-[12px] font-semibold normal-case tracking-normal text-slate-900 outline-none" /></div>
          {suggestionsOpen && party.trim() && <div className="absolute left-0 top-full z-30 mt-2 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 normal-case tracking-normal shadow-xl">
            {suggestionsLoading ? <div className="px-3 py-3 text-[12px] font-medium text-slate-500">Finding {status} {kind} order parties…</div> : matchingParties.length ? matchingParties.map(({ name }) => <button key={name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setParty(name); setSelectedParty(name); setSuggestionsOpen(false); void loadOrders(name); }} className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-800">{name}</button>) : <div className="px-3 py-3 text-[12px] font-medium text-slate-500">No matching parties with {status} {kind} orders.</div>}
          </div>}
        </label>
        <button type="button" disabled={loading || !company || !selectedParty} onClick={() => void loadOrders()} className="connect-action inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white disabled:opacity-60"><ArrowDownToLine size={14}/>{loadedFor === selectedParty ? "Refresh" : "Load"}</button>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Order type" className="relative inline-grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <span aria-hidden="true" className={`absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${kind === "purchase" ? "translate-x-full" : "translate-x-0"}`} />
        {([["sales", "Sales Orders"], ["purchase", "Purchase Orders"]] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={kind === value} onClick={() => { setKind(value); setRows([]); setLoadedFor(""); setSelectedParty(""); setSuggestions([]); }} className={`relative z-10 rounded-lg px-4 py-2 text-[12px] font-bold transition-colors duration-200 ${kind === value ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>)}
      </div>
      <div role="tablist" aria-label="Order status" className="relative inline-grid grid-cols-3 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <span aria-hidden="true" className={`absolute bottom-1 top-1 left-1 w-[calc(33.333%-2.667px)] rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${status === "closed" ? "translate-x-full" : status === "all" ? "translate-x-[200%]" : "translate-x-0"}`} />
        {([["open", "Open"], ["closed", "Closed"], ["all", "All"]] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={status === value} onClick={() => { setStatus(value); setSelectedParty(""); setRows([]); setLoadedFor(""); setSuggestions([]); }} className={`relative z-10 rounded-lg px-4 py-2 text-[12px] font-bold transition-colors duration-200 ${status === value ? "text-white" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>)}
      </div>
    </div>

    {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-900">{error}</div>}
    {loading && <div role="status" className="mt-4 rounded-xl border border-indigo-100 bg-white p-5 text-[13px] text-slate-600"><span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600 align-[-2px]"/>Loading {kind} orders for {party.trim()}…</div>}
    {loadedFor && !loading && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div className="text-[13px] font-bold text-slate-900">{loadedFor}<span className="ml-2 text-[11px] font-semibold text-slate-500">{visibleRows.length} {status} orders</span></div><div className="text-[11px] text-slate-500">Pre-closed orders are classified as closed.</div></div>
      {!visibleRows.length ? <div className="p-10 text-center text-[13px] text-slate-500">No {status} orders returned for this party.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[12px]"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Ordered</th><th className="px-4 py-3 text-right">Delivered / received</th><th className="px-4 py-3 text-right">Remaining</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.flatMap((row, rowIndex) => (row.items.length ? row.items : [{ name: "—", ordered: "", fulfilled: "", remaining: "" }]).map((item, itemIndex) => <tr key={`${row.number}-${rowIndex}-${itemIndex}`} className="text-slate-700"><td className="whitespace-nowrap px-4 py-3">{row.date || "—"}</td><td className="px-4 py-3 font-semibold text-slate-900">{row.reference || row.number || "—"}</td><td className="max-w-[280px] truncate px-4 py-3">{item.name}</td><td className="px-4 py-3 text-right tabular-nums">{item.ordered || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{item.fulfilled || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{item.remaining || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${getRowStatus(row) === "Open" ? "bg-emerald-50 text-emerald-700" : getRowStatus(row) === "Status unavailable" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{getRowStatus(row)}</span></td></tr>))}</tbody></table></div>}
    </div>}
    {!loadedFor && !loading && !error && <div className="mt-5 grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 text-center"><div><ClipboardList size={25} className="mx-auto text-indigo-500"/><div className="mt-3 text-[14px] font-bold text-slate-800">Choose a party to view its orders</div><p className="mt-1 text-[12px] text-slate-500">Only that party’s order records will be requested from Tally.</p></div></div>}
  </section>;
}
