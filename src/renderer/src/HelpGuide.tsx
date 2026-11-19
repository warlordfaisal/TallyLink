import {
  ArrowRight,
  Check,
  CircleHelp,
  ExternalLink,
  Laptop,
  Lightbulb,
  Plug,
  Server,
  ShieldCheck,
  Wifi,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

function Step({ number, title, children, tone = "indigo" }: { number: string; title: string; children: ReactNode; tone?: "indigo" | "teal" | "amber" }) {
  const color = tone === "teal" ? "bg-teal-50 text-teal-700 ring-teal-100" : tone === "amber" ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-indigo-50 text-indigo-700 ring-indigo-100";
  return <li className="relative flex gap-3 pb-5 last:pb-0"><span className={`relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ring-4 ring-white ${color}`}>{number}</span><div className="min-w-0 pt-0.5"><h3 className="text-[13px] font-bold text-slate-900">{title}</h3><div className="mt-1 text-[12px] leading-5 text-slate-600">{children}</div></div></li>;
}

function GuideCard({ title, eyebrow, icon: Icon, tone, children }: { title: string; eyebrow: string; icon: typeof Server; tone: "indigo" | "teal"; children: ReactNode }) {
  const theme = tone === "teal"
    ? { icon: "bg-teal-50 text-teal-700", line: "before:bg-teal-100", label: "text-teal-700" }
    : { icon: "bg-indigo-50 text-indigo-700", line: "before:bg-indigo-100", label: "text-indigo-700" };
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${theme.icon}`}><Icon size={19}/></span><div><div className={`text-[9px] font-extrabold tracking-[.16em] ${theme.label}`}>{eyebrow}</div><h2 className="mt-0.5 text-[16px] font-bold tracking-tight text-slate-900">{title}</h2></div></div>
    <ol className={`relative px-5 py-4 before:absolute before:bottom-6 before:left-[34px] before:top-7 before:w-px ${theme.line}`}>{children}</ol>
  </article>;
}

export default function HelpGuide({ port, onOpenConnect }: { port: number; onOpenConnect: () => void }) {
  return <section className="report-screen animate-[rise-in_.35s_ease-out_both]">
    <div className="relative mb-5 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#252b68] via-[#433eaa] to-[#6559d9] px-6 py-6 text-white shadow-lg shadow-indigo-950/10 sm:px-8 sm:py-7">
      <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border border-white/10 shadow-[0_0_0_25px_rgba(255,255,255,.025),0_0_0_60px_rgba(255,255,255,.02)]"/>
      <div className="relative flex flex-wrap items-end justify-between gap-5"><div className="max-w-[670px]"><div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-extrabold tracking-[.16em] text-indigo-100"><CircleHelp size={12}/> TALLYLINK HELP CENTER</div><h1 className="mt-3 text-[25px] font-extrabold leading-tight tracking-[-.04em] sm:text-[30px]">Connect Tally, step by step</h1><p className="mt-2 max-w-[600px] text-[12px] leading-5 text-indigo-100/85">Set up TallyPrime or Tally.ERP 9 on this computer, find its HTTP port, and link the right company to TallyLink.</p></div><button type="button" onClick={onOpenConnect} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[12px] font-bold text-indigo-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50">Open connection settings <ArrowRight size={14}/></button></div>
    </div>

    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/75 p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-700 shadow-sm"><Laptop size={17}/></span><div><div className="text-[11px] font-bold text-slate-900">Same computer</div><div className="mt-0.5 text-[10px] leading-4 text-slate-600">TallyLink connects to Tally running on this PC.</div></div></div>
      <div className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50/75 p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-teal-700 shadow-sm"><ShieldCheck size={17}/></span><div><div className="text-[11px] font-bold text-slate-900">Read-only reports</div><div className="mt-0.5 text-[10px] leading-4 text-slate-600">TallyLink reads report data; it does not edit vouchers.</div></div></div>
      <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50/75 p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm"><Wifi size={17}/></span><div><div className="text-[11px] font-bold text-slate-900">Current saved port</div><div className="mt-0.5 text-[10px] leading-4 text-slate-600">Last entered port: <strong className="text-slate-800">{port || "Not set"}</strong></div></div></div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <GuideCard title="TallyPrime" eyebrow="NEWER TALLY VERSIONS" icon={Server} tone="indigo">
        <Step number="1" title="Open the connection settings">Open TallyPrime and load the company you want to use. Press <strong>F1 (Help) → Settings → Connectivity → Client/Server Configuration.</strong></Step>
        <Step number="2" title="Turn on the HTTP server">Set TallyPrime to act as <strong>HTTP Server</strong> or <strong>Both</strong>, then enable the <strong>HTTP Server</strong> option. TallyLink uses XML over HTTP; ODBC is not required.</Step>
        <Step number="3" title="Check and save the port">Find the <strong>Port</strong> field. TallyPrime commonly uses <strong>9000</strong>, but use the number shown on this screen. Save the settings and restart TallyPrime if it asks.</Step>
        <Step number="4" title="Keep the company open">Return to TallyPrime and make sure the correct company is loaded before connecting from TallyLink.</Step>
      </GuideCard>

      <GuideCard title="Tally.ERP 9" eyebrow="CLASSIC TALLY VERSIONS" icon={Server} tone="teal">
        <Step number="1" title="Open Advanced Configuration" tone="teal">Open Tally.ERP 9 and load the company. From Gateway of Tally, press <strong>F12: Configure → Advanced Configuration.</strong></Step>
        <Step number="2" title="Set it up as a server" tone="teal">Under <strong>Client/Server Configuration</strong>, set “Tally.ERP 9 is acting as” to <strong>Server</strong> or <strong>Both</strong>.</Step>
        <Step number="3" title="Read the Port field" tone="teal">Note the number in <strong>Port</strong> (often 9000). Save with <strong>Ctrl+A</strong>. Restart Tally.ERP 9 if prompted. ODBC is only needed by applications that use ODBC.</Step>
        <Step number="4" title="Keep the company open" tone="teal">Return to Tally.ERP 9 and leave the company you want to connect open.</Step>
      </GuideCard>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-700"><Plug size={16}/></span><h2 className="text-[15px] font-bold text-slate-900">Connect TallyLink</h2></div><ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {["In TallyLink, click the connection status button in the sidebar.", "Enter the exact port shown in Tally. Example: 9000 or 9001.", "Click Test connection, choose the company, then save it."] .map((text, index) => <li key={text} className="flex gap-2.5 rounded-xl bg-slate-50 p-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-extrabold text-violet-700 shadow-sm">{index + 1}</span><span className="text-[11px] leading-5 text-slate-600">{text}</span></li>)}
      </ol><div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[10px] leading-4 text-emerald-900"><Check size={14} className="mt-0.5 shrink-0 text-emerald-700"/>A successful connection means Tally replied on that port. Select the intended company before saving.</div></article>

      <article className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-amber-700 shadow-sm"><Lightbulb size={16}/></span><h2 className="text-[15px] font-bold text-slate-900">Using ERP 9 and Prime together?</h2></div><p className="mt-2 text-[11px] leading-5 text-slate-600">Give each running Tally version its own port. For example, ERP 9 can use <strong>9000</strong> and Prime can use <strong>9001</strong>. When you switch versions, enter the port belonging to the Tally window you want TallyLink to read.</p><div className="mt-3 rounded-xl border border-amber-100 bg-white/80 p-3"><div className="flex justify-between text-[10px]"><span className="font-semibold text-slate-600">Tally.ERP 9</span><strong className="text-slate-900">9000</strong></div><div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[10px]"><span className="font-semibold text-slate-600">TallyPrime</span><strong className="text-slate-900">9001</strong></div></div></article>
    </div>

    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-700"><Wrench size={16}/></span><h2 className="text-[15px] font-bold text-slate-900">If it doesn’t connect</h2></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-800">“Could not reach Tally”</div><p className="mt-1 text-[10px] leading-4 text-slate-600">Check that Tally is open, HTTP Server is enabled, and the port in TallyLink exactly matches Tally.</p></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-800">It connects to the wrong Tally</div><p className="mt-1 text-[10px] leading-4 text-slate-600">Another Tally version may be using the saved port. Check the port inside each version and give them different numbers.</p></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-800">No company appears</div><p className="mt-1 text-[10px] leading-4 text-slate-600">Load a company in Tally first, then test the connection again.</p></div></div><div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-indigo-700"><a className="inline-flex items-center gap-1 hover:text-indigo-900" href="https://help.tallysolutions.com/xml-integration/" target="_blank" rel="noreferrer">Official TallyPrime XML setup <ExternalLink size={11}/></a><a className="inline-flex items-center gap-1 hover:text-indigo-900" href="https://help.tallysolutions.com/article/DeveloperReference/integration-capabilities/introduction.htm/" target="_blank" rel="noreferrer">Official ERP 9 integration guide <ExternalLink size={11}/></a></div></div>
  </section>;
}
