import { ArrowUpRight, FileText, HeartHandshake, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import { getConflicts } from "../../services/conflicts";
import { getMediationDraft } from "../../services/mediation";
import { getSavedAgreementDraft } from "../../services/agreements";

export default function RecentCases() {
  const cases = getConflicts().slice(0, 3);

  return (
    <section className="space-y-5" aria-labelledby="recent-cases-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="recent-cases-heading" className="text-2xl font-bold text-forest">Your recent cases</h2>
          <p className="mt-1 text-sm text-ink/60">Continue where you left off, in this browser.</p>
        </div>
        <Link to="/conflict/new" className="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:underline">
          New report <ArrowUpRight size={16} />
        </Link>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Your wildlife coexistence stories will appear here once you submit a report."
          action={<Link to="/conflict/new" className="inline-block rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-leaf">Report your first conflict</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cases.map((conflict) => {
            const hasAgreement = Boolean(getSavedAgreementDraft(conflict.id));
            const hasMediation = Boolean(getMediationDraft(conflict.id));
            const nextStep = hasAgreement || hasMediation ? "agreement" : "assessment";
            const label = hasAgreement ? "Agreement draft saved" : hasMediation ? "Plan selected" : "Assessment ready";
            const Icon = hasAgreement ? ScrollText : hasMediation ? HeartHandshake : FileText;

            return (
              <article key={conflict.id} className="rounded-3xl border border-forest/10 bg-white/85 p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/25 px-3 py-1.5 text-xs font-semibold text-forest">
                    <Icon size={13} aria-hidden="true" /> {label}
                  </span>
                  <span className="text-xs text-ink/45">{new Date(conflict.createdAt).toLocaleDateString()}</span>
                </div>
                <h3 className="text-lg font-semibold text-forest">{conflict.title}</h3>
                <p className="mt-2 text-sm text-ink/60">{conflict.location}</p>
                <Link
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:underline"
                  to={`/conflict/${encodeURIComponent(conflict.id)}/${nextStep}`}
                >
                  {hasAgreement || hasMediation ? "View agreement" : "Continue assessment"} <ArrowUpRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
