import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpenText,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthScreen from "./AuthScreen";
import { supabase } from "./supabase";

type UpdateStatus = { status: string; detail?: string };
type SalesRow = {
  date: string;
  number: string;
  party: string;
  amount: number;
  received: number;
  balance: number;
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = new Date();
const fiscalYearStart = `${today.getFullYear() - (today.getMonth() < 3 ? 1 : 0)}-04-01`;
const todayIso = localDate(today);
const formatMoney = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const formatReportDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
const daysSince = (value: string) => {
  const voucherDay = Date.parse(`${value}T00:00:00Z`);
  const todayDay = Date.parse(`${todayIso}T00:00:00Z`);
  return Number.isFinite(voucherDay)
    ? Math.max(0, Math.floor((todayDay - voucherDay) / 86_400_000))
    : "—";
};

const reportIdeas = [
  {
    title: "Sales & collections",
    detail: "Invoices with receipts matched to each sale",
    icon: TrendingUp,
    color: "violet",
    tag: "POPULAR",
  },
  {
    title: "Payment tracking",
    detail: "See what came in and what is still due",
    icon: WalletCards,
    color: "mint",
    tag: "CASH FLOW",
  },
  {
    title: "Ledger explorer",
    detail: "Build a view around the ledgers you choose",
    icon: BookOpenText,
    color: "amber",
    tag: "CUSTOM",
  },
];

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [update, setUpdate] = useState<UpdateStatus>({ status: "idle" });
  const [connectOpen, setConnectOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [comingSoonTip, setComingSoonTip] = useState("");
  const [comingSoonTipHovered, setComingSoonTipHovered] = useState(false);
  const companyMenuRef = useRef<HTMLDivElement>(null);
  const [tallyPort, setTallyPort] = useState("9000");
  const [connection, setConnection] = useState<{
    status: "idle" | "connecting" | "connected" | "error";
    error?: string;
    companies?: string[];
    port?: number;
  }>({ status: "idle" });
  const [companyDraft, setCompanyDraft] = useState(
    () => localStorage.getItem("tallylink-company") ?? "",
  );
  const [selectedCompany, setSelectedCompany] = useState(
    () => localStorage.getItem("tallylink-company") ?? "",
  );
  const [activeView, setActiveView] = useState<"overview" | "sales">(
    "overview",
  );
  const [reportStatus, setReportStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [reportRows, setReportRows] = useState<SalesRow[]>([]);
  const [reportError, setReportError] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [reportFrom, setReportFrom] = useState(fiscalYearStart);
  const [reportTo, setReportTo] = useState(todayIso);
  const [launchReportAfterSelection, setLaunchReportAfterSelection] =
    useState(false);
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setAuthSession(data.session);
        setAuthReady(true);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => window.desktop.onUpdateStatus(setUpdate), []);
  useEffect(() => {
    if (!companyMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!companyMenuRef.current?.contains(event.target as Node))
        setCompanyMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [companyMenuOpen]);
  useEffect(() => {
    if (!comingSoonTip || comingSoonTipHovered) return;
    const timeout = window.setTimeout(() => setComingSoonTip(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [comingSoonTip, comingSoonTipHovered]);
  const checkUpdates = async () =>
    setUpdate(await window.desktop.checkForUpdates());
  const connectTally = async () => {
    if (typeof window.desktop?.connectTally !== "function") {
      setConnection({
        status: "error",
        error:
          "The desktop connection module has not loaded. Close and restart TallyLink, then try again.",
      });
      return;
    }
    setConnection({ status: "connecting" });
    try {
      const result = await window.desktop.connectTally(Number(tallyPort));
      const companies = result.companies ?? [];
      setConnection(
        result.connected
          ? {
              status: "connected",
              companies,
              port: result.port ?? Number(tallyPort),
            }
          : {
              status: "error",
              error: result.error ?? "Could not connect to Tally.",
            },
      );
      if (result.connected) {
        setCompanyDraft((current) =>
          current && companies.includes(current)
            ? current
            : companies.length === 1
              ? companies[0]
              : "",
        );
        const savedCompany = localStorage.getItem("tallylink-company") ?? "";
        if (savedCompany && !companies.includes(savedCompany)) {
          localStorage.removeItem("tallylink-company");
          setSelectedCompany("");
        }
      }
    } catch (error) {
      setConnection({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  useEffect(() => {
    if (authSession) void connectTally();
  }, [authSession?.user.id]);

  const saveCompany = () => {
    if (!companyDraft) return;
    if (companyDraft !== selectedCompany) setSelectedParty("");
    localStorage.setItem("tallylink-company", companyDraft);
    setSelectedCompany(companyDraft);
    setConnectOpen(false);
    if (launchReportAfterSelection) {
      setLaunchReportAfterSelection(false);
      void loadSalesReport(companyDraft);
    }
  };

  const loadSalesReport = async (company = selectedCompany) => {
    if (!company) {
      setLaunchReportAfterSelection(true);
      setConnectOpen(true);
      return;
    }
    if (connection.status !== "connected") {
      setLaunchReportAfterSelection(true);
      setConnectOpen(true);
      return;
    }
    setActiveView("sales");
    setReportStatus("loading");
    setReportError("");
    try {
      if (typeof window.desktop?.fetchSalesReport !== "function") {
        throw new Error(
          "The report module has not loaded. Restart TallyLink and try again.",
        );
      }
      const result = await window.desktop.fetchSalesReport({
        company,
        port: connection.port ?? Number(tallyPort),
        fromDate: reportFrom,
        toDate: reportTo,
      });
      if (!result.ok)
        throw new Error(
          result.error || "Tally could not return the sales report.",
        );
      const rows = result.rows ?? [];
      setReportRows(rows);
      setSelectedParty((current) =>
        current && rows.some((row) => row.party === current) ? current : "",
      );
      setReportStatus("loaded");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : String(error));
      setReportStatus("error");
    }
  };

  const partyLedgers = [
    ...reportRows.reduce((ledgers, row) => {
      const summary = ledgers.get(row.party) ?? {
        invoices: 0,
        sales: 0,
        received: 0,
        balance: 0,
      };
      summary.invoices += 1;
      summary.sales += row.amount;
      summary.received += row.received;
      summary.balance += row.balance;
      ledgers.set(row.party, summary);
      return ledgers;
    }, new Map<string, { invoices: number; sales: number; received: number; balance: number }>()),
  ]
    .map(([name, summary]) => ({ name, ...summary }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const visiblePartyLedgers = partyLedgers.filter((ledger) =>
    ledger.name.toLocaleLowerCase().includes(partySearch.toLocaleLowerCase()),
  );
  const filteredReportRows = selectedParty
    ? reportRows.filter((row) => row.party === selectedParty)
    : [];
  const reportTotals = filteredReportRows.reduce(
    (totals, row) => ({
      sales: totals.sales + row.amount,
      received: totals.received + row.received,
      balance: totals.balance + row.balance,
    }),
    { sales: 0, received: 0, balance: 0 },
  );

  if (!authReady) {
    return <div className="auth-shell grid min-h-screen place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" aria-label="Checking your session" /></div>;
  }
  if (!authSession) return <AuthScreen />;

  return (
    <div className="app-shell min-h-screen text-slate-900">
      <aside className="sidebar fixed inset-y-0 left-0 z-20 flex w-[250px] flex-col px-4 text-white">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.09] px-2">
          <div className="brand-mark grid h-10 w-10 place-items-center rounded-[14px] text-white">
            <Command size={20} strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-[-0.04em]">
              TallyLink
            </div>
            <div className="mt-0.5 text-[11px] font-semibold tracking-[0.19em] text-indigo-200/65">
              REPORTING STUDIO
            </div>
          </div>
        </div>

        <div className="relative mt-5" ref={companyMenuRef}>
          <button
            type="button"
            aria-label="Switch Tally company"
            aria-haspopup="listbox"
            aria-expanded={companyMenuOpen}
            onClick={() => setCompanyMenuOpen((open) => !open)}
            className="company-switch flex w-full items-center gap-3 rounded-2xl border border-white/10 p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 text-amber-950 shadow-lg shadow-orange-950/30">
              <BookOpenText size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-100/75">
                Tally Company
              </span>
              <span
                title={selectedCompany || companyDraft}
                className={`mt-1 block truncate text-[13px] ${connection.status === "connected" ? "font-bold text-white" : "font-semibold text-indigo-100/80"}`}
              >
                {connection.status === "connected"
                  ? selectedCompany || companyDraft || "Choose a company"
                  : "Not connected"}
              </span>
            </span>
            <ChevronDown size={15} className={`shrink-0 text-indigo-100/65 transition-transform ${companyMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {companyMenuOpen && (
            <div
              role="listbox"
              aria-label="Tally companies"
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-64 overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-1.5 text-slate-800 shadow-[0_16px_40px_rgba(15,23,42,.28)] ring-1 ring-black/5 animate-[rise-in_.16s_ease-out_both]"
            >
              {(connection.companies ?? []).length ? (
                connection.companies!.map((company) => (
                  <button
                    key={company}
                    type="button"
                    role="option"
                    aria-selected={selectedCompany === company}
                    onClick={() => {
                      setCompanyMenuOpen(false);
                      if (company === selectedCompany) return;
                      setCompanyDraft(company);
                      setSelectedCompany(company);
                      setSelectedParty("");
                      localStorage.setItem("tallylink-company", company);
                      if (activeView === "sales") void loadSalesReport(company);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold transition ${selectedCompany === company ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
                  >
                    <span className="truncate">{company}</span>
                    {selectedCompany === company && <Check size={14} className="ml-2 shrink-0 text-indigo-600" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-[12px] leading-5 text-slate-500">
                  No companies found. Open the connection settings to refresh Tally.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="nav-label mt-8 px-3">WORKSPACE</div>
        <button
          onClick={() => setActiveView("overview")}
          className={`${activeView === "overview" ? "nav-active" : "text-indigo-100/75 hover:bg-white/[0.06]"} mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition`}
        >
          <LayoutDashboard size={17} /> Overview{" "}
          {activeView === "overview" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_2px_rgba(103,232,249,.65)]" />
          )}
        </button>
        <div className="nav-label mt-8 px-3">YOUR REPORTS</div>
        <button
          onClick={() => void loadSalesReport()}
          className={`${activeView === "sales" ? "nav-active" : "text-indigo-100/75 hover:bg-white/[0.06]"} mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition`}
        >
          <TrendingUp size={16} /> Sales & collections
        </button>

        <div className="mt-auto pb-4">
          <div className="mb-3 h-px bg-white/[0.09]" />
          <div className="relative">
            <button onClick={() => setComingSoonTip(comingSoonTip === "settings" ? "" : "settings")} aria-expanded={comingSoonTip === "settings"} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-indigo-100/75 transition hover:bg-white/[0.06] hover:text-white">
              <Settings2 size={16} /> Settings
            </button>
            {comingSoonTip === "settings" && <div role="tooltip" onMouseEnter={() => setComingSoonTipHovered(true)} onMouseLeave={() => setComingSoonTipHovered(false)} className="absolute bottom-0 left-full z-50 ml-3 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"><span className="font-bold text-indigo-700">First draft preview</span><br />Settings are being built and will be fully available soon.</div>}
          </div>
          <div className="relative">
            <button onClick={() => setComingSoonTip(comingSoonTip === "help" ? "" : "help")} aria-expanded={comingSoonTip === "help"} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-indigo-100/75 transition hover:bg-white/[0.06] hover:text-white">
              <CircleHelp size={16} /> Help & support
            </button>
            {comingSoonTip === "help" && <div role="tooltip" onMouseEnter={() => setComingSoonTipHovered(true)} onMouseLeave={() => setComingSoonTipHovered(false)} className="absolute bottom-0 left-full z-50 ml-3 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"><span className="font-bold text-indigo-700">First draft preview</span><br />Help & support are being built and will be fully available soon.</div>}
          </div>
          <button
            type="button"
            title="Manage Tally connection"
            onClick={() => setConnectOpen(true)}
            className={`${connection.status === "connected" ? "safe-pill" : "disconnected-pill"} mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300`}
          >
            {connection.status === "connected" ? (
              <Wifi size={15} />
            ) : (
              <WifiOff size={15} />
            )}
            {connection.status === "connected" ? "Connected · All systems ready" : "Disconnected"}
          </button>
          <div className="relative mt-2">
            <button
              type="button"
              disabled={update.status === "checking" || update.status === "downloading"}
              onClick={() => update.status === "downloaded" ? void window.desktop.installUpdate() : void checkUpdates()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-indigo-100/75 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              <ArrowDownToLine size={15} className={update.status === "checking" || update.status === "downloading" ? "animate-bounce" : ""} />
              {update.status === "downloaded" ? "Restart to update" : update.status === "checking" ? "Checking for updates…" : update.status === "downloading" ? "Downloading update…" : "Check Update"}
            </button>
            {(update.status === "available" || update.status === "downloading" || update.status === "downloaded") && (
              <div role="status" className="absolute bottom-0 left-full z-50 ml-3 w-60 rounded-xl border border-indigo-100 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl">
                <span className="font-bold text-indigo-700">{update.status === "downloaded" ? "Update ready" : update.status === "downloading" ? "Downloading update" : "Update available"}</span>
                <br />
                {update.status === "downloaded" ? "Click Restart to update to install it." : update.status === "downloading" ? `Downloading in the background${update.detail ? ` · ${update.detail}` : "…"}` : `Version ${update.detail ?? "newer"} is downloading in the background.`}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="ml-[250px] min-h-screen">
        <header className="topbar sticky top-0 z-10 flex h-[70px] items-center justify-between px-9">
          <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
            <span>{activeView === "sales" ? "Reports" : "Workspace"}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700">
              {activeView === "sales" ? "Sales & collections" : "Overview"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedCompany && <div title={selectedCompany} className="mr-2 inline-flex max-w-[240px] items-center gap-2 truncate rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-800"><BookOpenText size={14} className="shrink-0" /><span className="truncate">{selectedCompany}</span></div>}
            <div className="relative">
            <button aria-label="Search" aria-expanded={comingSoonTip === "search"} onClick={() => setComingSoonTip(comingSoonTip === "search" ? "" : "search")} className="top-icon">
              <Search size={17} />
            </button>
            {comingSoonTip === "search" && <div role="tooltip" onMouseEnter={() => setComingSoonTipHovered(true)} onMouseLeave={() => setComingSoonTipHovered(false)} className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"><span className="font-bold text-indigo-700">First draft preview</span><br />Search is being built and will be fully available soon.</div>}
            </div>
            <div className="relative">
            <button aria-label="Notifications" aria-expanded={comingSoonTip === "notifications"} onClick={() => setComingSoonTip(comingSoonTip === "notifications" ? "" : "notifications")} className="top-icon relative">
              <Bell size={17} />
              <span className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-rose-400 ring-2 ring-white" />
            </button>
            {comingSoonTip === "notifications" && <div role="tooltip" onMouseEnter={() => setComingSoonTipHovered(true)} onMouseLeave={() => setComingSoonTipHovered(false)} className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"><span className="font-bold text-indigo-700">First draft preview</span><br />Notifications are being built and will be fully available soon.</div>}
            </div>
            <div className="relative ml-2 border-l border-slate-200 pl-4">
              <button onClick={() => setComingSoonTip(comingSoonTip === "brand" ? "" : "brand")} aria-expanded={comingSoonTip === "brand"} className="flex items-center gap-2.5 rounded-lg text-left">
              <div className="avatar grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white">
                TL
              </div>
              <div className="text-[12px] font-semibold text-slate-700">
                TallyLink
              </div>
              </button>
              {comingSoonTip === "brand" && <div role="tooltip" onMouseEnter={() => setComingSoonTipHovered(true)} onMouseLeave={() => setComingSoonTipHovered(false)} className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"><span className="font-bold text-indigo-700">First draft preview</span><br />TallyLink is taking shape. More features are coming soon.</div>}
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void supabase?.auth.signOut()}
              className="top-icon ml-1"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-9 pb-10 pt-8">
          {activeView === "overview" ? (
            <>
              <section className="hero-card relative overflow-hidden rounded-[26px] px-8 py-7 text-white shadow-xl shadow-indigo-200/50">
                <div className="hero-orb hero-orb-one" />
                <div className="hero-orb hero-orb-two" />
                <div className="hero-content relative z-[1] flex items-center justify-between gap-8">
                  <div className="max-w-[560px]">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold tracking-[0.12em] text-indigo-50">
                      <Sparkles size={13} /> YOUR FINANCIAL OVERVIEW
                    </div>
                    <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.045em]">
                      Make your numbers
                      <br />
                      work harder for you.
                    </h1>
                    <p className="mt-3 max-w-[410px] text-[13px] leading-5 text-indigo-100/80">
                      Bring Tally data into clear, flexible reports built around
                      the way your business works.
                    </p>
                  </div>
                  <div
                    className="hero-visual hidden min-w-[260px] flex-1 justify-end md:flex"
                    aria-hidden="true"
                  >
                    <div className="float-card chart-card relative w-[258px] rounded-2xl border border-white/20 bg-white/[0.14] p-4 shadow-2xl shadow-indigo-950/20 backdrop-blur-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[11px] font-medium text-indigo-100/80">
                            BUSINESS SNAPSHOT
                          </div>
                          <div className="mt-1 text-[19px] font-bold tracking-tight">
                            Looking clear
                          </div>
                        </div>
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-300/20 text-emerald-200">
                          <TrendingUp size={16} />
                        </div>
                      </div>
                      <div className="mt-4 flex h-[80px] items-end gap-2 rounded-xl bg-indigo-950/15 px-3 pb-2 pt-3">
                        {[32, 48, 38, 62, 52, 78, 67, 94, 76, 100, 86, 113].map(
                          (height, index) => (
                            <span
                              key={index}
                              className="chart-bar flex-1 rounded-t-[4px] bg-gradient-to-t from-cyan-300/45 to-white/90"
                              style={{
                                height: `${height * 0.62}px`,
                                animationDelay: `${index * 55}ms`,
                              }}
                            />
                          ),
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-indigo-100/75">
                        <span>Reports designed around you</span>
                        <span>✦</span>
                      </div>
                      <div className="floating-chip absolute -left-8 top-[82px] flex items-center gap-2 rounded-xl border border-white/30 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-xl">
                        <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                          <Check size={13} />
                        </span>{" "}
                        Read-only & secure
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-7">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <div className="section-kicker">A GOOD PLACE TO BEGIN</div>
                    <h2 className="mt-1 text-[17px] font-bold tracking-[-0.025em] text-slate-800">
                      Reports made for your workflow
                    </h2>
                  </div>
                  <button className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 transition hover:gap-2">
                    Explore ideas <ArrowUpRight size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3.5">
                  {reportIdeas.map(
                    ({ title, detail, icon: Icon, color, tag }, index) => (
                      <button
                        key={title}
                        onClick={
                          index === 0 ? () => void loadSalesReport() : undefined
                        }
                        className={`idea-card idea-${color} group relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="idea-icon grid h-10 w-10 place-items-center rounded-[13px]">
                            <Icon size={19} />
                          </div>
                          <span className="idea-tag rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.1em]">
                            {tag}
                          </span>
                        </div>
                        <div className="mt-4 text-[13px] font-bold text-slate-800">
                          {title}
                        </div>
                        <div className="mt-1 max-w-[220px] text-[12px] leading-[17px] text-slate-500">
                          {detail}
                        </div>
                        <div className="idea-arrow absolute bottom-4 right-4 grid h-7 w-7 translate-y-1 place-items-center rounded-full opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                          <ArrowRight size={14} />
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </section>

              <section className="setup-panel mt-5 grid min-h-[220px] grid-cols-[1.15fr_.85fr] overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_10px_35px_rgba(40,56,110,.07)]">
                <div className="flex flex-col items-start justify-center px-7 py-6">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-violet-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />{" "}
                    STEP 1 · GET CONNECTED
                  </div>
                  <h2 className="mt-3 text-[18px] font-bold tracking-[-0.03em] text-slate-800">
                    Your reports start with a connection
                  </h2>
                  <p className="mt-1.5 max-w-[420px] text-[12px] leading-[18px] text-slate-500">
                    Use the connection status badge in the sidebar to connect
                    Tally ERP or TallyPrime. Your accounting data stays
                    untouched.
                  </p>
                </div>
                <div className="setup-art relative flex items-center justify-center overflow-hidden">
                  <div className="art-glow" />
                  <div className="art-ring art-ring-one" />
                  <div className="art-ring art-ring-two" />
                  <div className="report-preview relative z-[1] w-[225px] rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-xl shadow-indigo-200/50 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
                        <FileText size={14} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-700">
                          Sales & collections
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Custom report preview
                        </div>
                      </div>
                      <div className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-violet-50 text-violet-600">
                        <Sparkles size={11} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-2.5">
                      <div className="grid grid-cols-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <span>Invoice</span>
                        <span>Received</span>
                        <span>Balance</span>
                      </div>
                      <div className="h-px bg-slate-200" />
                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                          INV-1042
                        </span>
                        <span>₹ 24,000</span>
                        <span>₹ 0</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          INV-1043
                        </span>
                        <span>₹ 12,500</span>
                        <span>₹ 7,500</span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                      <ShieldCheck size={11} /> Data stays read-only
                    </div>
                  </div>
                  <div className="art-sticker absolute right-[12%] top-[18%] grid h-9 w-9 place-items-center rounded-xl bg-amber-300 text-amber-950 shadow-lg">
                    <WalletCards size={17} />
                  </div>
                  <div className="art-sticker art-sticker-two absolute bottom-[17%] left-[12%] grid h-8 w-8 place-items-center rounded-xl bg-cyan-300 text-cyan-950 shadow-lg">
                    <Check size={15} />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="report-screen animate-[rise-in_.4s_ease-out_both]">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      onClick={() => setActiveView("overview")}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 transition hover:gap-2"
                    >
                      <ArrowRight className="rotate-180" size={14} /> Overview
                    </button>
                    <span className="section-kicker">CUSTOM REPORT</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <h1 className="text-[22px] font-bold tracking-[-0.035em] text-slate-900">
                      Sales & collections
                    </h1>
                    <p className="text-[14px] text-slate-600">
                      Invoice sales, allocated receipts & balances
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <label className="grid gap-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    From
                    <input
                      type="date"
                      value={reportFrom}
                      max={reportTo}
                      onChange={(event) => setReportFrom(event.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[13px] font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-400"
                    />
                  </label>
                  <label className="grid gap-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    To
                    <input
                      type="date"
                      value={reportTo}
                      min={reportFrom}
                      max={todayIso}
                      onChange={(event) => setReportTo(event.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[13px] font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-400"
                    />
                  </label>
                  <button
                    disabled={reportStatus === "loading"}
                    onClick={() => void loadSalesReport()}
                    className="connect-action inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <ArrowDownToLine size={15} /> Refresh
                  </button>
                </div>
              </div>

              {reportStatus === "error" && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[14px] leading-6 text-rose-900">
                  <AlertCircle
                    size={18}
                    className="mt-1 shrink-0 text-rose-700"
                  />
                  <div>
                    <div className="font-bold">Couldn’t load the report</div>
                    <div>{reportError}</div>
                  </div>
                </div>
              )}

              {reportStatus === "loading" && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-[0_12px_35px_rgba(40,56,110,.08)]" role="status" aria-live="polite">
                  <div className="flex items-center gap-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-4">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                      <span className="absolute inset-0 animate-ping rounded-xl bg-indigo-200/50" />
                      <TrendingUp className="relative" size={19} />
                    </span>
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">Loading Sales & collections</div>
                      <div className="mt-0.5 text-[12px] text-slate-600">Reading invoices and receipt allocations from Tally…</div>
                    </div>
                    <span className="ml-auto h-5 w-5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="grid grid-cols-6 gap-3">
                      {["w-2/3", "w-3/4", "w-1/2", "w-2/3", "w-1/2", "w-1/2"].map((width, index) => <div key={index} className={`h-3 ${width} animate-pulse rounded-full bg-slate-100`} />)}
                    </div>
                    {Array.from({ length: 6 }, (_, index) => (
                      <div key={index} className="grid grid-cols-6 items-center gap-3 border-t border-slate-50 pt-3">
                        {["w-3/4", "w-1/2", "w-2/3", "w-1/2", "w-2/3", "w-1/3"].map((width, cell) => <div key={cell} className={`h-3 ${width} animate-pulse rounded-full bg-slate-100`} style={{ animationDelay: `${(index * 6 + cell) * 45}ms` }} />)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportStatus === "loaded" && (
                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-4 pb-4 pt-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-indigo-800">
                            Party ledgers
                          </div>
                          <div className="mt-1 text-[13px] text-slate-600">
                            Select a customer account
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 shadow-sm">
                          {partyLedgers.length}
                        </span>
                      </div>
                      <div className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 shadow-sm">
                        <Search size={17} />
                        <input
                          value={partySearch}
                          onChange={(event) =>
                            setPartySearch(event.target.value)
                          }
                          placeholder="Search party ledgers"
                          className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-slate-800 outline-none placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="max-h-[620px] overflow-y-auto p-2">
                      {visiblePartyLedgers.map((ledger) => (
                        <button
                          key={ledger.name}
                          onClick={() => setSelectedParty(ledger.name)}
                          className={`party-ledger-row mb-1 w-full rounded-xl border px-3 py-2.5 text-left transition ${selectedParty === ledger.name ? "party-ledger-selected border-indigo-200 bg-indigo-50" : "border-transparent hover:border-slate-100 hover:bg-slate-50"}`}
                        >
                          <div className="truncate text-[14px] font-bold text-slate-900">
                            {ledger.name}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-slate-600">
                            <span>
                              {ledger.invoices.toLocaleString("en-IN")} invoices
                            </span>
                            <span className="truncate font-semibold text-amber-800">
                              Due {formatMoney.format(ledger.balance)}
                            </span>
                          </div>
                        </button>
                      ))}
                      {visiblePartyLedgers.length === 0 && (
                        <div className="px-3 py-10 text-center">
                          <div className="text-[14px] font-semibold text-slate-800">
                            No party ledgers found
                          </div>
                          <div className="mt-1 text-[12px] text-slate-600">
                            Try another search.
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {selectedParty ? (
                    <section className="min-w-0">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="metric-card rounded-xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-3">
                          <div className="text-[13px] font-semibold text-slate-600">
                            Sales invoices
                          </div>
                          <div className="mt-1 text-[19px] font-bold tracking-tight text-violet-800">
                            {formatMoney.format(reportTotals.sales)}
                          </div>
                          <div className="mt-0.5 text-[12px] font-medium text-violet-900">
                            Total Invoices:{" "}
                            {filteredReportRows.length.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="metric-card rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-3">
                          <div className="text-[13px] font-semibold text-slate-600">
                            Allocated receipts
                          </div>
                          <div className="mt-1 truncate text-[19px] font-bold tracking-tight text-emerald-900">
                            {formatMoney.format(reportTotals.received)}
                          </div>
                          <div className="mt-0.5 text-[12px] text-emerald-800">
                            Against this ledger
                          </div>
                        </div>
                        <div className="metric-card rounded-xl border border-amber-100 bg-gradient-to-br from-white to-amber-50 p-3">
                          <div className="text-[13px] font-semibold text-slate-600">
                            Outstanding balance
                          </div>
                          <div className="mt-1 truncate text-[19px] font-bold tracking-tight text-amber-900">
                            {formatMoney.format(reportTotals.balance)}
                          </div>
                          <div className="mt-0.5 text-[12px] text-amber-800">
                            Closing amount due
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-600">
                              Party ledger
                            </div>
                            <h2 className="mt-1 truncate text-[18px] font-bold text-slate-950">
                              {selectedParty}
                            </h2>
                          </div>
                          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-[12px] font-semibold text-indigo-800">
                            {formatReportDate(reportFrom)} —{" "}
                            {formatReportDate(reportTo)}
                          </div>
                        </div>
                        <div className="max-h-[560px] overflow-auto">
                          <table className="min-w-[760px] w-full border-collapse text-left">
                            <thead className="sticky top-0 z-[1] bg-slate-50 text-[12px] font-bold uppercase tracking-[0.06em] text-slate-600">
                              <tr>
                                <th className="px-4 py-3.5">Date</th>
                                <th className="px-3 py-3.5">Particulars</th>
                                <th className="px-3 py-3.5">Voucher no.</th>
                                <th className="px-3 py-3.5 text-right">
                                  Sales
                                </th>
                                <th className="px-3 py-3.5 text-right">
                                  Received
                                </th>
                                <th className="px-4 py-3.5 text-right">
                                  Balance
                                </th>
                                <th className="px-4 py-3.5 text-right">Days passed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[14px]">
                              {filteredReportRows.map((row, index) => (
                                <tr
                                  key={`${row.number}-${row.date}-${index}`}
                                  className="transition hover:bg-indigo-50/45"
                                >
                                  <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                                    {formatReportDate(row.date)}
                                  </td>
                                  <td className="px-3 py-4">
                                    <span className="rounded-md bg-violet-50 px-2.5 py-1.5 text-[12px] font-bold text-violet-800">
                                      Sales invoice
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 font-bold text-slate-900">
                                    {row.number || "—"}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-slate-900">
                                    {formatMoney.format(row.amount)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-emerald-800">
                                    {formatMoney.format(row.received)}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums text-slate-950">
                                    {formatMoney.format(row.balance)}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-slate-600">
                                    {daysSince(row.date)}
                                  </td>
                                </tr>
                              ))}
                              {filteredReportRows.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-5 py-16 text-center"
                                  >
                                    <div className="text-[15px] font-semibold text-slate-800">
                                      No invoices for this party
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
                      </div>
                    </section>
                  ) : (
                    <section className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-indigo-200 bg-white/75 p-8 text-center">
                      <div>
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                          <BookOpenText size={22} />
                        </div>
                        <h2 className="mt-4 text-[17px] font-bold text-slate-900">
                          Choose a party ledger
                        </h2>
                        <p className="mt-1 max-w-[300px] text-[14px] leading-6 text-slate-600">
                          Search the list and select a customer to open their
                          sales ledger with allocated receipts and balance.
                        </p>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {reportStatus === "idle" && (
                <div className="mt-6 grid min-h-[260px] place-items-center rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <TrendingUp size={22} />
                    </div>
                    <div className="mt-4 text-[16px] font-bold text-slate-900">
                      Choose a date range to get started
                    </div>
                    <div className="mt-1 text-[14px] text-slate-600">
                      Sales invoices and allocated receipts will appear here.
                    </div>
                    <button
                      onClick={() => void loadSalesReport()}
                      className="connect-action mt-4 rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
                    >
                      Load report
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          <footer className="mt-5 flex items-center justify-between rounded-xl border border-white/80 bg-white/75 px-4 py-3 text-[13px] text-slate-600 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span className="font-semibold text-slate-600">
                Your data is read-only
              </span>
              <span className="text-slate-300">·</span>
              <span>Private to your workspace</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-indigo-700">
              <span>For software solutions, call</span>
              <span className="font-bold text-indigo-800">90283 60408</span>
            </div>
          </footer>
        </div>
      </main>

      {connectOpen && (
        <div
          className="connect-overlay fixed inset-0 z-50 flex items-center justify-center p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConnectOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            className="connect-dialog w-full max-w-[460px] overflow-hidden rounded-[24px] bg-white shadow-2xl shadow-indigo-950/25"
          >
            <div className="connect-dialog-head relative overflow-hidden px-6 pb-5 pt-6 text-white">
              <div className="connect-dialog-orb" />
              <button
                aria-label="Close"
                onClick={() => setConnectOpen(false)}
                className="absolute right-4 top-4 z-[1] grid h-8 w-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"
              >
                <X size={17} />
              </button>
              <div className="relative z-[1] grid h-10 w-10 place-items-center rounded-[13px] border border-white/15 bg-white/15">
                <BookOpenText size={19} />
              </div>
              <h2
                id="connect-title"
                className="relative z-[1] mt-4 text-[20px] font-bold tracking-tight"
              >
                Connect to Tally
              </h2>
              <p className="relative z-[1] mt-1 max-w-[350px] text-[12px] leading-5 text-indigo-100/75">
                We’ll check the local Tally XML interface and find the companies
                it can see.
              </p>
            </div>
            <div className="px-6 pb-6 pt-5">
              <label
                htmlFor="tally-port"
                className="block text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500"
              >
                HTTP port
              </label>
              <div className="mt-2 flex gap-2">
                <div className="flex h-11 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500">
                  <span>http://127.0.0.1:</span>
                  <input
                    id="tally-port"
                    inputMode="numeric"
                    value={tallyPort}
                    onChange={(event) =>
                      setTallyPort(
                        event.target.value.replace(/\D/g, "").slice(0, 5),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void connectTally();
                    }}
                    className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none"
                    aria-label="Tally HTTP port"
                  />
                </div>
                <button
                  disabled={connection.status === "connecting"}
                  onClick={() => void connectTally()}
                  className="connect-action inline-flex min-w-[116px] items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
                >
                  {connection.status === "connecting" ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />{" "}
                      Checking
                    </>
                  ) : (
                    "Test connection"
                  )}
                </button>
              </div>

              {connection.status === "connected" && (
                <>
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                        <Check size={12} />
                      </span>
                      <div>
                        <div className="text-[12px] font-bold text-emerald-900">
                          Connected to Tally
                        </div>
                        <div className="mt-0.5 text-[12px] leading-4 text-emerald-800">
                          {connection.companies?.length
                            ? `Found ${connection.companies.length} compan${connection.companies.length === 1 ? "y" : "ies"}.`
                            : "Tally answered successfully. No company names were returned."}
                        </div>
                      </div>
                    </div>
                  </div>
                  {!!connection.companies?.length && (
                    <div className="mt-4">
                      <label
                        htmlFor="tally-company"
                        className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500"
                      >
                        Tally Company
                      </label>
                      <select
                        id="tally-company"
                        value={companyDraft}
                        onChange={(event) =>
                          setCompanyDraft(event.target.value)
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="">Choose a company</option>
                        {connection.companies.map((company) => (
                          <option key={company} value={company}>
                            {company}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!companyDraft}
                        onClick={saveCompany}
                        className="connect-action mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Check size={15} /> Use this company
                      </button>
                    </div>
                  )}
                </>
              )}
              {connection.status === "error" && (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-rose-600"
                  />
                  <div className="text-[12px] leading-4 text-rose-800">
                    {connection.error}
                  </div>
                </div>
              )}
              {connection.status !== "connected" && (
                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5">
                  <div className="text-[12px] font-bold text-indigo-900">
                    Check this in Tally if it doesn’t connect
                  </div>
                  <ol className="mt-2 space-y-1.5 pl-4 text-[11px] leading-[15px] text-indigo-900/75">
                    <li className="list-decimal">
                      Keep the company open in Tally.
                    </li>
                    <li className="list-decimal">
                      Enable its HTTP server / act as a server, using this port
                      (default <strong>9000</strong>).
                    </li>
                    <li className="list-decimal">
                      Try the connection again. This check only reads the
                      company list.
                    </li>
                  </ol>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={13} className="text-emerald-600" /> Read-only
                check · no Tally data is changed
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
