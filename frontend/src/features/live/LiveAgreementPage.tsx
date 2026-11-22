import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  Leaf,
  PenLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingState from "../../components/ui/LoadingState";
import LeafSpinner from "../../components/ui/LeafSpinner";
import { leafBurst } from "../../components/ui/leafBurst";
import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import { formatDate, partyLabel } from "../../services/live/adapters";
import { errorMessage } from "../../services/live/client";
import type { Agreement } from "../../services/live/types";
import { useLiveConflict } from "./useLiveConflict";
import { useSession } from "./session";

const statusText: Record<string, string> = {
  draft: "Draft, waiting for your signature",
  active: "Active agreement",
  expired: "Expired",
  terminated: "Ended early",
};

export default function LiveAgreementPage() {
  const { id } = useParams();
  const session = useSession();
  const conflict = useLiveConflict(id, "agreement");
  const agreementId = conflict.data?.agreement_id ?? null;
  const agreement = useLiveData<Agreement>(agreementId ? `agreement:${agreementId}` : null, () => liveApi.getAgreement(agreementId!));
  const solutionId = agreement.data?.solution_id ?? null;
  const solution = useLiveData(solutionId ? `solution:${solutionId}` : null, () => liveApi.getSolution(solutionId!));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (conflict.loading) return <LoadingState label="Opening your case…" />;
  const report = conflict.data;
  if (conflict.error || !report) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Conflict not found</h1>
        <p className="text-sm text-ink/60">{conflict.error}</p>
        <Link to="/conflict/new" className="font-semibold text-leaf underline">Report a conflict</Link>
      </Card>
    );
  }

  if (!agreementId) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Choose a compromise first</h1>
        <p className="text-sm leading-relaxed text-ink/60">
          This case has no agreement yet. Negotiate and accept a plan in the Mediation Studio, and the agreement is
          written for you.
        </p>
        <Link className="font-semibold text-leaf underline" to={`/conflict/${report.id}/mediation`}>Go to Mediation Studio</Link>
      </Card>
    );
  }

  if (agreement.loading && !agreement.data) return <LoadingState label="Fetching the agreement…" />;
  if (agreement.error || !agreement.data) {
    return (
      <Card className="space-y-3">
        <p role="alert" className="text-sm text-red-700">{agreement.error}</p>
        <Button variant="secondary" onClick={agreement.reload}>Try again</Button>
      </Card>
    );
  }

  const data = agreement.data;
  const signedByMe = data.signatures.some((s) => s.user_id === session?.user.id);
  const canSign = !signedByMe && (data.status === "draft" || data.status === "active");
  const human = data.parties.find((p) => p.role === "reporter");
  const wildlife = data.parties.find((p) => p.role === "species_representative");

  async function sign(button: HTMLElement) {
    // Remember where the button is: it is replaced by the "You signed" note once signing works.
    const spot = button.getBoundingClientRect();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      agreement.setData(await liveApi.signAgreement(data.id));
      conflict.reload();
      setMessage("Signed. Thank you for making room for your wild neighbor.");
      leafBurst(spot);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(data.markdown);
      setMessage("Agreement text copied to your clipboard.");
    } catch {
      setError("Clipboard access isn't available here. Use the download button instead.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([data.markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `coexistence-agreement-${data.id.slice(0, 8)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-bold text-forest">
          <Leaf size={15} /> STEP 04 · COEXISTENCE AGREEMENT
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          A better way to <span className="text-leaf">share our space.</span>
        </h1>
        <p className="max-w-2xl text-ink/65">
          A temporary agreement, valid {formatDate(data.valid_from)} to {formatDate(data.valid_until)}
          {data.days_remaining > 0 ? ` (${data.days_remaining} days left)` : ""}. It ends when the sensitive season does.
        </p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden !p-0">
          <div className="bg-forest px-6 py-8 text-cream sm:px-9 sm:py-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage">Neighborhood agreement · 2126</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{data.title}</h2>
              </div>
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold">
                {statusText[data.status] ?? data.status}
              </span>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-9">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-sage/20 p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-leaf">Human representative</p>
                <p className="flex items-center gap-3 text-lg font-bold text-forest"><UserRound size={22} /> {human?.name ?? report.reporter_name}</p>
              </div>
              <div className="rounded-2xl bg-peach/35 p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-leaf">Fictional wildlife representative</p>
                <p className="flex items-center gap-3 text-lg font-bold text-forest">
                  <span className="text-3xl" aria-hidden="true">{report.species.emoji}</span> {wildlife?.name ?? report.species.representative_name}
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-forest/10 bg-cream p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-leaf">Selected compromise</p>
                <h3 className="mt-2 text-xl font-bold text-forest">{solution.data?.title ?? "…"}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/60">{solution.data?.summary}</p>
              </div>
              <div className="rounded-2xl bg-sage/40 px-5 py-4 text-center">
                <p className="text-3xl font-bold tabular-nums text-forest">
                  {Math.round(data.coexistence_index)}<span className="text-base text-ink/50">/100</span>
                </p>
                <p className="mt-1 text-xs font-medium text-forest">Coexistence Index</p>
              </div>
            </div>

            <section>
              <h3 className="mb-4 flex items-center gap-3 text-lg font-bold text-forest">
                <span className="rounded-xl bg-sage/25 p-2.5"><Leaf size={20} /></span> 01 / What the wildlife needs
              </h3>
              <div className="space-y-3">
                {data.wildlife_expectations.map((item, i) => (
                  <div key={i} className="rounded-2xl border border-forest/10 bg-white p-4">
                    <h4 className="font-semibold text-forest">{item.period} <span className="font-normal text-ink/50">· {item.months}</span></h4>
                    <p className="mt-1 text-sm leading-relaxed text-ink/65">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-4 flex items-center gap-3 text-lg font-bold text-forest">
                <span className="rounded-xl bg-sage/25 p-2.5"><CheckCircle2 size={20} /></span> 02 / Who does what
              </h3>
              <div className="space-y-3">
                {data.terms.map((term) => (
                  <div key={term.id} className="rounded-2xl border border-forest/10 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-leaf" />
                      <div>
                        <h4 className="font-semibold text-forest">{term.id} · {partyLabel(term.party)}</h4>
                        <p className="mt-1 text-sm leading-relaxed text-ink/65">{term.commitment}</p>
                        <p className="mt-2 text-xs text-ink/45">
                          When: {term.when ?? "ongoing"}{term.cost_eur ? ` · about ${term.cost_eur} EUR` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-sage/20 p-5">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-forest"><CalendarCheck size={20} /> 03 / Check-ins</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-ink/70">
                {data.monitoring.map((item) => (
                  <li key={item.date} className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-leaf">•</span>
                    <span><strong>{formatDate(item.date)}</strong> · {item.check} <span className="text-ink/45">({item.by})</span></span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 font-bold text-forest"><PenLine size={20} /> 04 / Signatures</h3>
              {data.signatures.length === 0 ? (
                <p className="text-sm text-ink/60">No signatures yet.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {data.signatures.map((s, i) => (
                    <li key={i} className="rounded-2xl border border-forest/10 bg-white p-4 text-sm">
                      <span className="text-2xl" aria-hidden="true">{s.mark.split(" ")[0]}</span>
                      <p className="mt-1 font-semibold text-forest">{s.name}</p>
                      <p className="text-xs text-ink/50">{partyLabel(s.party)} · {formatDate(s.signed_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex items-start gap-3 border-t border-forest/10 pt-6 text-xs leading-relaxed text-ink/60">
              <ShieldCheck size={20} className="shrink-0 text-leaf" />
              <p>
                The wildlife representative is a storytelling character, not a consenting party. Its "signature" stands
                for the species' ecological data. Real works near protected species still need the proper permits.
              </p>
            </div>
          </div>
        </Card>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <Card className="space-y-4">
            <div className="inline-flex rounded-2xl bg-sage/30 p-3 text-forest"><FileText size={25} /></div>
            <h2 className="text-xl font-bold text-forest">Your agreement</h2>
            <p className="text-sm leading-relaxed text-ink/60">
              {data.status === "draft"
                ? "The representative has signed. Your signature activates the agreement and marks the zone on the map."
                : "Signed agreements stay in the backend. Copy or download the text to share it."}
            </p>
            <div className="space-y-3">
              {canSign && (
                <Button onClick={(event) => sign(event.currentTarget)} disabled={busy} className="w-full">
                  {busy ? <LeafSpinner size={17} /> : <PenLine size={17} />} {busy ? "Signing…" : "Sign the agreement"}
                </Button>
              )}
              {signedByMe && (
                <p className="flex items-start gap-2 text-sm font-medium text-leaf"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /> You signed this agreement.</p>
              )}
              <Button variant="secondary" onClick={copy} className="w-full"><ClipboardCopy size={17} /> Copy agreement text</Button>
              <Button variant="secondary" onClick={download} className="w-full"><Download size={17} /> Download as Markdown</Button>
            </div>
            {message && <p role="status" className="text-sm text-leaf">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          </Card>

          <p className="rounded-2xl bg-peach/35 p-5 text-sm text-ink/70">
            Next review: <strong>{data.review_dates[0] ? formatDate(data.review_dates[0]) : "at the end of the season"}</strong>
          </p>

          <Link to={`/conflict/${report.id}/mediation`} className="inline-flex items-center gap-2 text-sm font-semibold text-leaf underline">
            <ArrowLeft size={16} /> Back to Mediation Studio
          </Link>
        </aside>
      </div>
    </div>
  );
}
