import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, LogIn, Server } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { API_BASE_URL } from "../../services/apiClient";
import { errorMessage, login } from "../../services/live/client";
import { DEMO_PASSWORD, demoAccounts } from "./session";

const inputStyle =
  "w-full rounded-xl border border-forest/15 bg-cream px-4 py-3 text-sm text-ink outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/10";

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState(demoAccounts[4].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate(next.startsWith("/") ? next : "/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="space-y-6">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
            <KeyRound size={15} /> LOG IN TO THE NEIGHBORHOOD
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-forest sm:text-4xl">
            Welcome back, <span className="text-leaf">neighbor.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/60">
            Reports, plans and agreements are saved in the mediation backend, so you need a resident account.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Email</span>
            <input className={inputStyle} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Password</span>
            <input className={inputStyle} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            <LogIn size={17} /> {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink/50">
          <Server size={14} className="mt-0.5 shrink-0" /> Backend: {API_BASE_URL}. Start it with <code>uvicorn app.main:app</code> in the backend folder.
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold text-forest">Try a demo resident</h2>
        <p className="text-sm text-ink/60">
          Every demo account uses the password <strong>{DEMO_PASSWORD}</strong>. Pick one to fill in the form.
        </p>
        <div className="space-y-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
              aria-pressed={email === account.email}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                email === account.email ? "border-leaf bg-sage/30" : "border-forest/10 bg-white hover:border-leaf"
              }`}
            >
              <span className="block text-sm font-semibold text-forest">{account.name}</span>
              <span className="mt-1 block text-xs text-ink/60">{account.story}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
