import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  Command,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { supabase } from "./supabase";

type AuthMode = "welcome" | "signin" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!supabase) {
      setError("Supabase is not configured. Add the project URL and publishable key to the root .env.local file, then restart the app.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              mobile: mobile.trim(),
              business_name: businessName.trim(),
            },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Account created. Check your email for a confirmation link, then sign in here.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : String(authError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen overflow-auto p-6 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1120px] items-center">
        <div className="grid w-full overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(39,46,105,.18)] lg:grid-cols-[1.05fr_.95fr]">
          <section className="auth-showcase relative hidden min-h-[660px] flex-col justify-between overflow-hidden p-10 text-white lg:flex">
            <div className="auth-orb auth-orb-one" />
            <div className="auth-orb auth-orb-two" />
            <div className="relative z-[1] flex items-center gap-3">
              <div className="brand-mark grid h-11 w-11 place-items-center rounded-[15px] text-white"><Command size={21} strokeWidth={2.4} /></div>
              <div>
                <div className="text-[17px] font-bold tracking-[-0.04em]">TallyLink</div>
                <div className="text-[10px] font-semibold tracking-[.19em] text-indigo-100/70">REPORTING STUDIO</div>
              </div>
            </div>
            <div className="relative z-[1] max-w-[430px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[.12em] text-indigo-50"><Sparkles size={13} /> YOUR TALLY WORKSPACE</div>
              <h1 className="text-[38px] font-bold leading-[1.12] tracking-[-.045em]">Clearer reports.<br />Better decisions.</h1>
              <p className="mt-4 max-w-[390px] text-[14px] leading-6 text-indigo-100/80">Sign in to view sales, collections, and customer balances from your connected Tally company.</p>
              <div className="mt-8 space-y-3">
                {[
                  "Read-only access to your Tally data",
                  "Sales invoices and allocated receipts",
                  "Customer balances at a glance",
                ].map((item) => <div key={item} className="flex items-center gap-2.5 text-[13px] font-medium text-white/90"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-300/20 text-emerald-200"><Check size={12} /></span>{item}</div>)}
              </div>
            </div>
            <div className="relative z-[1] flex items-center gap-2 text-[11px] text-indigo-100/65"><ShieldCheck size={14} /> Your accounting data stays read-only.</div>
          </section>

          <section className="flex min-h-[600px] flex-col justify-center px-7 py-9 sm:px-12 lg:px-14">
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <div className="brand-mark grid h-10 w-10 place-items-center rounded-[14px] text-white"><Command size={19} /></div>
              <span className="text-[17px] font-bold tracking-[-.04em]">TallyLink</span>
            </div>

            {mode === "welcome" ? (
              <div className="auth-content">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><BookOpenText size={22} /></div>
                <div className="mt-6 text-[11px] font-bold uppercase tracking-[.14em] text-indigo-600">Welcome</div>
                <h2 className="mt-2 text-[29px] font-bold leading-tight tracking-[-.04em] text-slate-950">Your reports are ready when you are.</h2>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">Sign in to your account or create one to get started with TallyLink.</p>
                <div className="mt-8 grid gap-3">
                  <button onClick={() => changeMode("signin")} className="primary-button flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-bold text-white transition hover:-translate-y-0.5">Sign in <ArrowRight size={16} /></button>
                  <button onClick={() => changeMode("signup")} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[13px] font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/60">Create an account</button>
                </div>
              </div>
            ) : (
              <div className="auth-content">
                <button onClick={() => changeMode("welcome")} className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-indigo-700"><ArrowLeft size={14} /> Back</button>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-indigo-600">{mode === "signup" ? "Get started" : "Welcome back"}</div>
                <h2 className="mt-2 text-[27px] font-bold leading-tight tracking-[-.04em] text-slate-950">{mode === "signup" ? "Create your account" : "Sign in to TallyLink"}</h2>
                <p className="mt-2 text-[13px] leading-5 text-slate-600">{mode === "signup" ? "Your details help us set up your workspace." : "Use the email and password for your TallyLink account."}</p>

                <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-3.5">
                  {mode === "signup" && <>
                    <label className="block text-[11px] font-bold text-slate-600">Full name<input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" className="auth-input mt-1.5" /></label>
                    <label className="block text-[11px] font-bold text-slate-600">Mobile number<input autoComplete="tel" type="tel" required value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="+91 98765 43210" className="auth-input mt-1.5" /></label>
                    <label className="block text-[11px] font-bold text-slate-600">Business name <span className="font-medium text-slate-400">(optional)</span><input autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Your business" className="auth-input mt-1.5" /></label>
                  </>}
                  <label className="block text-[11px] font-bold text-slate-600">Email address<span className="relative mt-1.5 block"><Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="auth-input auth-input-icon" /></span></label>
                  <label className="block text-[11px] font-bold text-slate-600">Password<span className="relative mt-1.5 block"><LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} className="auth-input auth-input-icon" /></span></label>

                  {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12px] leading-5 text-rose-800">{error}</div>}
                  {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12px] leading-5 text-emerald-800">{notice}</div>}
                  {!supabase && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-5 text-amber-900">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to the root <code>.env.local</code>, then restart TallyLink.</div>}

                  <button disabled={busy || !supabase} className="primary-button flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}<ArrowRight size={15} /></button>
                </form>
                <div className="mt-5 text-center text-[12px] text-slate-500">{mode === "signup" ? "Already have an account?" : "New to TallyLink?"}{" "}<button onClick={() => changeMode(mode === "signup" ? "signin" : "signup")} className="font-bold text-indigo-600 hover:text-indigo-800">{mode === "signup" ? "Sign in" : "Create an account"}</button></div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><UserRound size={13} /> Secure account access by Supabase</div>
          </section>
        </div>
      </div>
    </div>
  );
}
