import type { Session } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpenText,
  Check,
  ChevronDown,
  ClipboardList,
  CircleHelp,
  Command,
  FileText,
  LayoutDashboard,
  LogOut,
  NotebookTabs,
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
import AuthScreen from "./AuthScreen";
import SalesInvoiceTable from "./SalesInvoiceTable";
import DayBookTable from "./DayBookTable";
import OrdersModule from "./OrdersModule";
import DashboardSummary from "./DashboardSummary";
import HelpGuide from "./HelpGuide";
import { supabase } from "./supabase";

type UpdateStatus = { status: string; detail?: string };
type SalesRow = {
  date: string;
  number: string;
  party: string;
  amount: number;
  received: number;
  balance: number;
  voucherType?: string;
  items?: Array<{ name: string; quantity: string }>;
};
type DayBookSale = { date: string; party: string; amount: number; items: Array<{ name: string; quantity: string }> };
type DayBookPayment = { date: string; party: string; amount: number };

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = new Date();
const defaultTallyPort = "9000";
const savedTallyPort = () => {
  const saved = localStorage.getItem("tallylink-port");
  const port = Number(saved);
  return saved && Number.isInteger(port) && port >= 1 && port <= 65535
    ? saved
    : defaultTallyPort;
};
const todayIso = localDate(today);
const defaultReportFrom = localDate(new Date(today.getFullYear(), today.getMonth(), 1));
const formatMoney = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const reportIdeas = [
  {
    title: "Sales & collections",
    detail: "Invoices with receipts matched to each sale",
    icon: TrendingUp,
    color: "violet",
    tag: "POPULAR",
  },
  {
    title: "Day Book",
    detail: "Review daily sales and payments",
    icon: NotebookTabs,
    color: "mint",
    tag: "DAILY ACTIVITY",
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
  const partyFetchRequestRef = useRef(0);
  const [tallyPort, setTallyPort] = useState(savedTallyPort);
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
  const [activeView, setActiveView] = useState<"overview" | "sales" | "daybook" | "orders" | "help">(
    "overview",
  );
  const [reportStatus, setReportStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [reportRows, setReportRows] = useState<SalesRow[]>([]);
  const [ledgerOutstandingRows, setLedgerOutstandingRows] = useState<SalesRow[]>([]);
  const [ledgerOutstandingsLoaded, setLedgerOutstandingsLoaded] = useState(false);
  const [ledgerDetailLoading, setLedgerDetailLoading] = useState(false);
  const [ledgerDetailError, setLedgerDetailError] = useState("");
  const [partyVoucherRows, setPartyVoucherRows] = useState<SalesRow[]>([]);
  const [partyVouchersLoading, setPartyVouchersLoading] = useState(false);
  const [partyVoucherError, setPartyVoucherError] = useState("");
  const [reportError, setReportError] = useState("");
  const [dayBookStatus, setDayBookStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [dayBookError, setDayBookError] = useState("");
  const [dayBookSales, setDayBookSales] = useState<DayBookSale[]>([]);
  const [dayBookPayments, setDayBookPayments] = useState<DayBookPayment[]>([]);
  const [partySearch, setPartySearch] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [showSettledInvoices, setShowSettledInvoices] = useState(false);
  const [reportFrom, setReportFrom] = useState(defaultReportFrom);
  const [reportTo, setReportTo] = useState(todayIso);
  const [dayBookFrom, setDayBookFrom] = useState(todayIso);
  const [dayBookTo, setDayBookTo] = useState(todayIso);
  const [launchReportAfterSelection, setLaunchReportAfterSelection] =
    useState<"sales" | "daybook" | null>(null);
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
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthSession(session);
        setAuthReady(true);
      },
    );
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => window.desktop.onUpdateStatus(setUpdate), []);
  useEffect(() => {
    const port = Number(tallyPort);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) {
      localStorage.setItem("tallylink-port", String(port));
    }
  }, [tallyPort]);
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
      const pendingView = launchReportAfterSelection;
      setLaunchReportAfterSelection(null);
      if (pendingView === "sales") void loadSalesReport(companyDraft);
      else void loadDayBook(companyDraft);
    }
  };

  const loadSalesReport = async (company = selectedCompany) => {
    if (!company) {
      setLaunchReportAfterSelection("sales");
      setConnectOpen(true);
      return;
    }
    if (connection.status !== "connected") {
      setLaunchReportAfterSelection("sales");
      setConnectOpen(true);
      return;
    }
    partyFetchRequestRef.current += 1;
    setLedgerDetailLoading(false);
    setPartyVouchersLoading(false);
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
        mode: "receivables",
      });
      if (!result.ok)
        throw new Error(
          result.error || "Tally could not return the sales report.",
        );
      const rows = result.rows ?? [];
      setReportRows(rows);
      setLedgerOutstandingRows([]);
      setLedgerOutstandingsLoaded(false);
      setLedgerDetailError("");
      setPartyVoucherRows([]);
      setPartyVoucherError("");
      setShowSettledInvoices(false);
      setSelectedParty((current) =>
        current && rows.some((row) => row.party === current) ? current : "",
      );
      setReportStatus("loaded");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : String(error));
      setReportStatus("error");
    }
  };

  const loadDayBook = async (company = selectedCompany) => {
    if (!company) {
      setLaunchReportAfterSelection("daybook");
      setActiveView("daybook");
      setConnectOpen(true);
      return;
    }
    if (connection.status !== "connected") {
      setLaunchReportAfterSelection("daybook");
      setActiveView("daybook");
      setConnectOpen(true);
      return;
    }
    setActiveView("daybook");
    setDayBookStatus("loading");
    setDayBookError("");
    try {
      const result = await window.desktop.fetchDayBook({
        company,
        port: connection.port ?? Number(tallyPort),
        fromDate: dayBookFrom,
        toDate: dayBookTo,
      });
      if (!result.ok) throw new Error(result.error || "Tally could not return the Day Book.");
      setDayBookSales(result.sales ?? []);
      setDayBookPayments(result.payments ?? []);
      setDayBookStatus("loaded");
    } catch (error) {
      setDayBookError(error instanceof Error ? error.message : String(error));
      setDayBookStatus("error");
    }
  };

  const selectPartyLedger = async (party: string) => {
    const requestId = ++partyFetchRequestRef.current;
    setSelectedParty(party);
    setShowSettledInvoices(false);
    setPartyVouchersLoading(false);
    setPartyVoucherRows([]);
    setPartyVoucherError("");
    setLedgerOutstandingRows([]);
    // Don't briefly present the all-party bill report as if it were the
    // selected ledger's complete bill-wise + on-account detail.
    setLedgerOutstandingsLoaded(true);
    setLedgerDetailLoading(true);
    setLedgerDetailError("");
    try {
      const result = await window.desktop.fetchSalesReport({
        company: selectedCompany,
        port: connection.port ?? Number(tallyPort),
        fromDate: reportFrom,
        toDate: reportTo,
        mode: "ledger-outstandings",
        party,
      });
      if (requestId !== partyFetchRequestRef.current) return;
      if (!result.ok) throw new Error(result.error || "Could not load this ledger's outstanding details.");
      const rows = result.rows ?? [];
      if (!rows.length && reportRows.some((row) => row.party === party)) {
        throw new Error("Tally returned no readable ledger detail for a party with open bills. No partial ledger was shown; refresh and try again.");
      }
      setLedgerOutstandingRows(rows);
      setLedgerOutstandingsLoaded(true);
    } catch (error) {
      if (requestId !== partyFetchRequestRef.current) return;
      setLedgerDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      if (requestId === partyFetchRequestRef.current) setLedgerDetailLoading(false);
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
    ? (showSettledInvoices
        ? partyVoucherRows
        : ledgerOutstandingsLoaded
          ? ledgerOutstandingRows
          : reportRows
      ).filter((row) => row.party === selectedParty)
    : [];
  const outstandingInvoices = filteredReportRows
    .filter((row) => row.balance > 0.005)
    .sort((a, b) => b.date.localeCompare(a.date) || b.balance - a.balance);
  const tableRows = showSettledInvoices ? filteredReportRows : outstandingInvoices;
  const toggleSettledView = async () => {
    if (!selectedParty || partyVouchersLoading) return;
    if (!showSettledInvoices) {
      const requestId = ++partyFetchRequestRef.current;
      setPartyVouchersLoading(true);
      setPartyVoucherError("");
      try {
        const result = await window.desktop.fetchSalesReport({
          company: selectedCompany,
          port: connection.port ?? Number(tallyPort),
          fromDate: reportFrom,
          toDate: reportTo,
          mode: "party-vouchers",
          party: selectedParty,
        });
        if (requestId !== partyFetchRequestRef.current) return;
        if (!result.ok) throw new Error(result.error || "Could not load this party's ledger movements.");
        setPartyVoucherRows(result.rows ?? []);
        setShowSettledInvoices(true);
      } catch (error) {
        if (requestId !== partyFetchRequestRef.current) return;
        setPartyVoucherError(error instanceof Error ? error.message : String(error));
      } finally {
        if (requestId === partyFetchRequestRef.current) setPartyVouchersLoading(false);
      }
    } else {
      setShowSettledInvoices(false);
    }
  };
  const reportTotals = filteredReportRows.reduce(
    (totals, row) => ({
      sales: totals.sales + row.amount,
      received: totals.received + row.received,
      balance: totals.balance + row.balance,
    }),
    { sales: 0, received: 0, balance: 0 },
  );

  if (!authReady) {
    return (
      <div className="auth-shell grid min-h-screen place-items-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600"
          aria-label="Checking your session"
        />
      </div>
    );
  }
  if (!authSession) return <AuthScreen />;

  return (
    <div className="app-shell min-h-screen text-slate-900">
      <aside className="sidebar app-sidebar fixed inset-y-0 left-0 z-20 flex w-[250px] flex-col px-4 text-white">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.09] px-2">
          <div className="brand-mark grid h-10 w-10 place-items-center rounded-[14px] text-white">
            <Command size={20} strokeWidth={2.4} />
          </div>
          <div className="sidebar-copy">
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
            title="Switch Tally company"
            aria-haspopup="listbox"
            aria-expanded={companyMenuOpen}
            onClick={() => setCompanyMenuOpen((open) => !open)}
            className="company-switch flex w-full items-center gap-3 rounded-2xl border border-white/10 p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 text-amber-950 shadow-lg shadow-orange-950/30">
              <BookOpenText size={17} />
            </span>
            <span className="sidebar-company-copy min-w-0 flex-1">
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
            <ChevronDown
              size={15}
              className={`sidebar-chevron shrink-0 text-indigo-100/65 transition-transform ${companyMenuOpen ? "rotate-180" : ""}`}
            />
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
                      if (activeView === "daybook") void loadDayBook(company);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold transition ${selectedCompany === company ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
                  >
                    <span className="truncate">{company}</span>
                    {selectedCompany === company && (
                      <Check
                        size={14}
                        className="ml-2 shrink-0 text-indigo-600"
                      />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-[12px] leading-5 text-slate-500">
                  No companies found. Open the connection settings to refresh
                  Tally.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="nav-label sidebar-heading mt-8 px-3">WORKSPACE</div>
        <button
          title="Overview"
          onClick={() => setActiveView("overview")}
          className={`${activeView === "overview" ? "nav-active" : "text-indigo-100/75 hover:bg-white/[0.06]"} mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition`}
        >
          <LayoutDashboard size={17} />{" "}
          <span className="sidebar-copy">Overview</span>{" "}
          {activeView === "overview" && (
            <span className="sidebar-indicator ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_2px_rgba(103,232,249,.65)]" />
          )}
        </button>
        <div className="nav-label sidebar-heading mt-8 px-3">YOUR REPORTS</div>
        <button
          title="Sales & collections"
          onClick={() => void loadSalesReport()}
          className={`${activeView === "sales" ? "nav-active" : "text-indigo-100/75 hover:bg-white/[0.06]"} mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition`}
        >
          <TrendingUp size={16} />{" "}
          <span className="sidebar-copy">Sales & collections</span>
        </button>
        <button
          title="Day Book"
          onClick={() => void loadDayBook()}
          className={`${activeView === "daybook" ? "nav-active" : "text-indigo-100/75 hover:bg-white/[0.06]"} mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition`}
        >
          <NotebookTabs size={16} />
          <span className="sidebar-copy">Day Book</span>
          {activeView === "daybook" && (
            <span className="sidebar-indicator ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_2px_rgba(103,232,249,.65)]" />
          )}
        </button>

        <button
          title="Orders"
          onClick={() => setActiveView("orders")}
          className={`${activeView === "orders" ? "nav-active" : "text-indigo-100/75 hover:bg-white/[0.06]"} mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold transition`}
        >
          <ClipboardList size={16} />
          <span className="sidebar-copy">Orders</span>
          {activeView === "orders" && <span className="sidebar-indicator ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_2px_rgba(103,232,249,.65)]" />}
        </button>

        <div className="mt-auto pb-4">
          <div className="mb-3 h-px bg-white/[0.09]" />
          <div className="relative">
            <button
              title="Settings"
              onClick={() =>
                setComingSoonTip(comingSoonTip === "settings" ? "" : "settings")
              }
              aria-expanded={comingSoonTip === "settings"}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-indigo-100/75 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Settings2 size={16} />{" "}
              <span className="sidebar-copy">Settings</span>
            </button>
            {comingSoonTip === "settings" && (
              <div
                role="tooltip"
                onMouseEnter={() => setComingSoonTipHovered(true)}
                onMouseLeave={() => setComingSoonTipHovered(false)}
                className="absolute bottom-0 left-full z-50 ml-3 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"
              >
                <span className="font-bold text-indigo-700">
                  First draft preview
                </span>
                <br />
                Settings are being built and will be fully available soon.
              </div>
            )}
          </div>
          <div className="relative">
            <button
              title="Help & support"
              onClick={() => { setComingSoonTip(""); setActiveView("help"); }}
              aria-current={activeView === "help" ? "page" : undefined}
              className={`${activeView === "help" ? "nav-active text-white" : "text-indigo-100/75 hover:bg-white/[0.06] hover:text-white"} flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition`}
            >
              <CircleHelp size={16} />{" "}
              <span className="sidebar-copy">Help &amp; support</span>
            </button>
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
            <span className="sidebar-copy">
              {connection.status === "connected"
                ? "Connected · All systems ready"
                : "Disconnected"}
            </span>
          </button>
          <div className="relative mt-2">
            <button
              type="button"
              disabled={
                update.status === "checking" || update.status === "downloading"
              }
              onClick={() =>
                update.status === "downloaded"
                  ? void window.desktop.installUpdate()
                  : void checkUpdates()
              }
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-indigo-100/75 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              <ArrowDownToLine
                size={15}
                className={
                  update.status === "checking" ||
                  update.status === "downloading"
                    ? "animate-bounce"
                    : ""
                }
              />
              <span className="sidebar-copy">
                {update.status === "downloaded"
                  ? "Restart to update"
                  : update.status === "checking"
                    ? "Checking for updates…"
                    : update.status === "downloading"
                      ? "Downloading update…"
                      : "Check Update"}
              </span>
            </button>
            {(update.status === "available" ||
              update.status === "downloading" ||
              update.status === "downloaded") && (
              <div
                role="status"
                className="absolute bottom-0 left-full z-50 ml-3 w-60 rounded-xl border border-indigo-100 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"
              >
                <span className="font-bold text-indigo-700">
                  {update.status === "downloaded"
                    ? "Update ready"
                    : update.status === "downloading"
                      ? "Downloading update"
                      : "Update available"}
                </span>
                <br />
                {update.status === "downloaded"
                  ? "Click Restart to update to install it."
                  : update.status === "downloading"
                    ? `Downloading in the background${update.detail ? ` · ${update.detail}` : "…"}`
                    : `Version ${update.detail ?? "newer"} is downloading in the background.`}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="app-main ml-[250px] flex min-h-screen flex-col">
        <header className="topbar sticky top-0 z-10 flex h-[70px] items-center justify-between px-2.5">
          <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
            <span>{activeView === "overview" ? "Workspace" : "Reports"}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700">
              {activeView === "sales" ? "Sales & collections" : activeView === "daybook" ? "Day Book" : activeView === "orders" ? "Orders" : activeView === "help" ? "Help & Support" : "Overview"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedCompany && (
              <div
                title={selectedCompany}
                className="mr-2 inline-flex max-w-[240px] items-center gap-2 truncate rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-800"
              >
                <BookOpenText size={14} className="shrink-0" />
                <span className="truncate">{selectedCompany}</span>
              </div>
            )}
            <div className="relative">
              <button
                aria-label="Search"
                aria-expanded={comingSoonTip === "search"}
                onClick={() =>
                  setComingSoonTip(comingSoonTip === "search" ? "" : "search")
                }
                className="top-icon"
              >
                <Search size={17} />
              </button>
              {comingSoonTip === "search" && (
                <div
                  role="tooltip"
                  onMouseEnter={() => setComingSoonTipHovered(true)}
                  onMouseLeave={() => setComingSoonTipHovered(false)}
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"
                >
                  <span className="font-bold text-indigo-700">
                    First draft preview
                  </span>
                  <br />
                  Search is being built and will be fully available soon.
                </div>
              )}
            </div>
            <div className="relative">
              <button
                aria-label="Notifications"
                aria-expanded={comingSoonTip === "notifications"}
                onClick={() =>
                  setComingSoonTip(
                    comingSoonTip === "notifications" ? "" : "notifications",
                  )
                }
                className="top-icon relative"
              >
                <Bell size={17} />
                <span className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-rose-400 ring-2 ring-white" />
              </button>
              {comingSoonTip === "notifications" && (
                <div
                  role="tooltip"
                  onMouseEnter={() => setComingSoonTipHovered(true)}
                  onMouseLeave={() => setComingSoonTipHovered(false)}
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"
                >
                  <span className="font-bold text-indigo-700">
                    First draft preview
                  </span>
                  <br />
                  Notifications are being built and will be fully available
                  soon.
                </div>
              )}
            </div>
            <div className="relative ml-2 border-l border-slate-200 pl-4">
              <button
                onClick={() =>
                  setComingSoonTip(comingSoonTip === "brand" ? "" : "brand")
                }
                aria-expanded={comingSoonTip === "brand"}
                className="flex items-center gap-2.5 rounded-lg text-left"
              >
                <div className="avatar grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white">
                  TL
                </div>
                <div className="text-[12px] font-semibold text-slate-700">
                  TallyLink
                </div>
              </button>
              {comingSoonTip === "brand" && (
                <div
                  role="tooltip"
                  onMouseEnter={() => setComingSoonTipHovered(true)}
                  onMouseLeave={() => setComingSoonTipHovered(false)}
                  className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 text-[12px] leading-5 text-slate-700 shadow-xl"
                >
                  <span className="font-bold text-indigo-700">
                    First draft preview
                  </span>
                  <br />
                  TallyLink is taking shape. More features are coming soon.
                </div>
              )}
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

        <div className="mx-auto w-full max-w-[1320px] flex-1 px-2.5 pb-3 pt-2.5">
          {activeView === "overview" ? (
            <DashboardSummary
              company={selectedCompany}
              port={connection.port ?? Number(tallyPort)}
              connected={connection.status === "connected"}
              onOpenSales={() => void loadSalesReport()}
              onOpenDayBook={() => void loadDayBook()}
              onOpenOrders={() => setActiveView("orders")}
            />
          ) : activeView === "sales" ? (
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
                    <h1 className="text-[22px] font-bold tracking-[-0.035em] text-slate-900">
                      Sales & collections
                    </h1>
                  </div>
                </div>
                {(!selectedParty || reportStatus !== "loaded") && (
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
                )}
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
                <div
                  className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-[0_12px_35px_rgba(40,56,110,.08)]"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-4">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                      <span className="absolute inset-0 animate-ping rounded-xl bg-indigo-200/50" />
                      <TrendingUp className="relative" size={19} />
                    </span>
                    <div>
                      <div className="text-[14px] font-bold text-slate-900">
                        Loading Sales & collections
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-600">
                        Reading the requested records from Tally…
                      </div>
                    </div>
                    <span className="ml-auto h-5 w-5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="grid grid-cols-6 gap-3">
                      {[
                        "w-2/3",
                        "w-3/4",
                        "w-1/2",
                        "w-2/3",
                        "w-1/2",
                        "w-1/2",
                      ].map((width, index) => (
                        <div
                          key={index}
                          className={`h-3 ${width} animate-pulse rounded-full bg-slate-100`}
                        />
                      ))}
                    </div>
                    {Array.from({ length: 6 }, (_, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-6 items-center gap-3 border-t border-slate-50 pt-3"
                      >
                        {[
                          "w-3/4",
                          "w-1/2",
                          "w-2/3",
                          "w-1/2",
                          "w-2/3",
                          "w-1/3",
                        ].map((width, cell) => (
                          <div
                            key={cell}
                            className={`h-3 ${width} animate-pulse rounded-full bg-slate-100`}
                            style={{
                              animationDelay: `${(index * 6 + cell) * 45}ms`,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportStatus === "loaded" && (
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
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
                    <div className="max-h-[70vh] overflow-y-auto p-2">
                      {visiblePartyLedgers.map((ledger) => (
                        <button
                          key={ledger.name}
                          onClick={() => {
                            void selectPartyLedger(ledger.name);
                          }}
                          className={`party-ledger-row mb-1 w-full rounded-xl border px-3 py-2.5 text-left transition ${selectedParty === ledger.name ? "party-ledger-selected border-indigo-200 bg-indigo-50" : "border-transparent hover:border-slate-100 hover:bg-slate-50"}`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">
                              {ledger.name}
                            </span>
                            <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {ledger.invoices.toLocaleString("en-IN")} inv.
                            </span>
                          </div>
                          <div className="mt-1 text-[12px] font-semibold text-amber-800">
                            Bill-wise due {formatMoney.format(ledger.balance)}
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
                            {showSettledInvoices ? "Sales / debit" : "Open receivables"}
                          </div>
                          <div className="mt-1 text-[19px] font-bold tracking-tight text-violet-800">
                            {formatMoney.format(reportTotals.sales)}
                          </div>
                          <div className="mt-0.5 text-[12px] font-medium text-violet-900">
                            {showSettledInvoices ? "Ledger entries: " : "Total invoices: "}{" "}
                            {filteredReportRows.length.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="metric-card rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-3">
                          <div className="text-[13px] font-semibold text-slate-600">
                            {showSettledInvoices ? "Received / credit" : "Open bills"}
                          </div>
                          <div className="mt-1 truncate text-[19px] font-bold tracking-tight text-emerald-900">
                            {showSettledInvoices ? formatMoney.format(reportTotals.received) : filteredReportRows.length.toLocaleString("en-IN")}
                          </div>
                          <div className="mt-0.5 text-[12px] text-emerald-800">
                            {showSettledInvoices ? "All credit entries" : "Outstanding bill-wise"}
                          </div>
                        </div>
                        <div className="metric-card rounded-xl border border-amber-100 bg-gradient-to-br from-white to-amber-50 p-3">
                          <div className="text-[13px] font-semibold text-slate-600">
                            {showSettledInvoices ? "Net debit movement" : "Outstanding balance"}
                          </div>
                          <div className="mt-1 truncate text-[19px] font-bold tracking-tight text-amber-900">
                            {formatMoney.format(reportTotals.balance)}
                          </div>
                          <div className="mt-0.5 text-[12px] text-amber-800">
                            {showSettledInvoices ? "Period debits less credits" : "Closing amount due"}
                          </div>
                        </div>
                      </div>
                      <SalesInvoiceTable
                        key={`${selectedParty}-${showSettledInvoices}`}
                        rows={tableRows}
                        fromDate={reportFrom}
                        toDate={reportTo}
                        party={selectedParty}
                        maxDate={todayIso}
                        onFromDateChange={setReportFrom}
                        onToDateChange={setReportTo}
                        onRefresh={() => void loadSalesReport()}
                        showSettled={showSettledInvoices}
                        settledCount={selectedParty ? (showSettledInvoices ? partyVoucherRows.length : 0) : 0}
                        onToggleSettled={() => void toggleSettledView()}
                        isLoading={partyVouchersLoading || ledgerDetailLoading}
                        loadError={partyVoucherError || ledgerDetailError}
                          emptyMessage={showSettledInvoices
                            ? "No debit or credit ledger entries for this party in the selected date range."
                            : "No open receivables for this party."}
                      />
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
                          Search the list and select a party to view open receivables or its dated debit and credit ledger entries.
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
          ) : activeView === "orders" ? (
            <OrdersModule key={selectedCompany} company={selectedCompany} port={connection.port ?? Number(tallyPort)} />
          ) : activeView === "help" ? (
            <HelpGuide port={connection.port ?? Number(tallyPort)} onOpenConnect={() => setConnectOpen(true)} />
          ) : (
            <section className="report-screen">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="section-kicker">TALLY REPORT</div>
                  <h1 className="mt-1 text-[22px] font-bold tracking-[-0.035em] text-slate-900">
                    Day Book
                  </h1>
                  <p className="mt-1 text-[12px] text-slate-600">
                    Sales and payments for the selected dates.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  <label className="grid gap-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    From
                    <input type="date" value={dayBookFrom} max={dayBookTo} onChange={(event) => setDayBookFrom(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[12px] font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-400" />
                  </label>
                  <label className="grid gap-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    To
                    <input type="date" value={dayBookTo} min={dayBookFrom} max={todayIso} onChange={(event) => setDayBookTo(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[12px] font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-400" />
                  </label>
                  <button type="button" disabled={dayBookStatus === "loading"} onClick={() => void loadDayBook()} className="connect-action inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white disabled:opacity-60">
                    <ArrowDownToLine size={14} /> Refresh
                  </button>
                </div>
              </div>
              {dayBookStatus === "error" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-900">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <div><div className="font-bold">Couldn’t load the Day Book</div><div>{dayBookError}</div></div>
                </div>
              )}
              {dayBookStatus === "loading" && (
                <div role="status" className="mt-4 rounded-xl border border-indigo-100 bg-white p-5 text-[13px] text-slate-600">
                  <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600 align-[-2px]" />
                  Loading sales and payments from Tally…
                </div>
              )}
              {dayBookStatus === "loaded" && (
                <DayBookTable key={`${selectedCompany}-${dayBookFrom}-${dayBookTo}`} sales={dayBookSales} payments={dayBookPayments} />
              )}
              {dayBookStatus === "idle" && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <div className="font-semibold text-slate-800">Load sales and payments from Tally</div>
                  <button type="button" onClick={() => void loadDayBook()} className="connect-action mt-3 rounded-lg px-4 py-2 text-[12px] font-bold text-white">Load Day Book</button>
                </div>
              )}
            </section>
          )}

        </div>
          <footer className="mx-auto mt-auto flex w-full max-w-[1320px] items-center justify-between border-t border-slate-200/80 bg-white/70 px-5 py-3 text-[12px] text-slate-600">
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
