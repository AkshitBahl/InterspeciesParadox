import { ArrowUpRight, FileText, HeartHandshake, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";

import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import { formatDate, statusLabels } from "../../services/live/adapters";
import type { BackendConflictStatus } from "../../services/live/types";
import { useSession } from "./session";

const stepFor: Record<BackendConflictStatus, { path: string; cta: string; icon: typeof FileText }> = {
  reported: { path: "assessment", cta: "Continue assessment", icon: FileText },
  assessed: { path: "mediation", cta: "See compromise plans", icon: FileText },
  solutions_proposed: { path: "mediation", cta: "Open mediation", icon: HeartHandshake },
  negotiating: { path: "mediation", cta: "Continue negotiating", icon: HeartHandshake },
  agreement_pending: { path: "agreement", cta: "Sign the agreement", icon: ScrollText },
  agreed: { path: "agreement", cta: "View agreement", icon: ScrollText },
  closed: { path: "agreement", cta: "View agreement", icon: ScrollText },
};

/** Dashboard list of cases from the backend (live mode). */
export default function LiveRecentCases() {
  const session = useSession();
  const cases = useLiveData(session ? `cases:${session.user.id}` : null, async () => {
    const [mine, all] = await Promise.all([liveApi.listConflicts(true), liveApi.listConflicts()]);
    return { mine, others: all.filter((c) => !mine.some((m) => m.id === c.id)) };
  });

  const heading = (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="recent-cases-heading" className="text-2xl font-bold text-forest">Your recent cases</h2>
        <p className="mt-1 text-sm text-ink/60">Saved in the mediation backend.</p>
      </div>
      <Link to="/conflict/new" className="inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:underline">
        New report <ArrowUpRight size={16} />
      </Link>
    </div>
  );

  if (!session) {
    return (
      <section className="space-y-5" aria-labelledby="recent-cases-heading">
        {heading}
        <EmptyState
          title="Log in to see your cases"
          description="Your reports, plans and agreements live in the backend under your account."
          action={<Link to="/login" className="inline-block rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-leaf">Log in</Link>}
        />
      </section>
    );
  }

  const mine = cases.data?.mine ?? [];
  const others = (cases.data?.others ?? []).slice(0, 3);
  const shown = mine.length > 0 ? mine.slice(0, 6) : others;

  return (
    <section className="space-y-5" aria-labelledby="recent-cases-heading">
      {heading}
      {cases.loading ? (
        <LoadingState compact label="Loading cases…" />
      ) : cases.error ? (
        <p role="alert" className="text-sm text-red-700">{cases.error}</p>
      ) : shown.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Your wildlife coexistence stories will appear here once you submit a report."
          action={<Link to="/conflict/new" className="inline-block rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-leaf">Report your first conflict</Link>}
        />
      ) : (
        <>
          {mine.length === 0 && <p className="text-sm text-ink/60">You haven't reported anything yet. Here's what your neighbors are working on:</p>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((conflict) => {
              const step = stepFor[conflict.status] ?? stepFor.reported;
              const Icon = step.icon;
              return (
                <article key={conflict.id} className="rounded-3xl border border-forest/10 bg-white/85 p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage/25 px-3 py-1.5 text-xs font-semibold text-forest">
                      <Icon size={13} aria-hidden="true" /> {statusLabels[conflict.status]}
                    </span>
                    <span className="text-xs text-ink/45">{formatDate(conflict.created_at)}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-forest">{conflict.species.emoji} {conflict.title}</h3>
                  <p className="mt-2 text-sm text-ink/60">
                    {conflict.reporter_name}
                    {conflict.best_index !== null ? ` · best index ${Math.round(conflict.best_index)}` : ""}
                  </p>
                  <Link className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-leaf hover:underline" to={`/conflict/${conflict.id}/${step.path}`}>
                    {step.cta} <ArrowUpRight size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
