import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, HeartHandshake, RefreshCw, ScrollText } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingState from "../../components/ui/LoadingState";
import EmptyState from "../../components/ui/EmptyState";
import { useLiveData } from "../../hooks/useLiveData";
import { ApiRequestError } from "../../services/apiClient";
import { liveApi } from "../../services/live/api";
import { speciesToRepresentative } from "../../services/live/adapters";
import { errorMessage } from "../../services/live/client";
import { getConflictExtras } from "../../services/live/extras";
import type { CounterProposalResult, Negotiation, Solution } from "../../services/live/types";

import LiveMap from "./LiveMap";
import LiveNegotiation from "./LiveNegotiation";
import LiveRepresentative from "./LiveRepresentative";
import { LiveComparison, LiveIndexPanel, LivePlanCard } from "./LivePlans";
import { useLiveConflict } from "./useLiveConflict";
import { useSession } from "./session";

const finished = ["agreement_pending", "agreed", "closed"];

export default function LiveMediationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const conflict = useLiveConflict(id, "mediation");
  const report = conflict.data;
  const conflictId = report?.id;
  const done = report ? finished.includes(report.status) : false;

  const solutions = useLiveData<Solution[]>(conflictId ? `solutions:${conflictId}` : null, async () => {
    const list = await liveApi.listSolutions(conflictId!);
    if (list.length > 0 || done) return list;
    // First visit: ask the mediator for plans (this also runs the assessment if needed).
    await liveApi.generateSolutions(conflictId!);
    return liveApi.listSolutions(conflictId!);
  });
  const negotiation = useLiveData<Negotiation | null>(conflictId ? `negotiation:${conflictId}` : null, async () => {
    try {
      return await liveApi.getNegotiation(conflictId!);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  });
  const species = useLiveData(report ? `species:${report.species.slug}` : null, () => liveApi.getSpecies(report!.species.slug));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastVerdict, setLastVerdict] = useState<CounterProposalResult | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  // Default selection: the plan on the negotiation table, else the best index.
  const list = solutions.data ?? [];
  const tableId = negotiation.data?.current_solution_id ?? null;
  const selected = list.find((s) => s.id === selectedId) ?? list.find((s) => s.id === tableId) ?? list[0];

  if (conflict.loading) return <LoadingState label="Opening your case…" />;
  if (conflict.error || !report) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Conflict not found</h1>
        <p className="text-ink/60">{conflict.error}</p>
        <Link className="font-semibold text-leaf underline" to="/conflict/new">Report a new conflict</Link>
      </Card>
    );
  }

  const isReporter = session?.user.id === report.reporter_id || Boolean(session?.user.is_admin);
  const representative = species.data ? speciesToRepresentative(species.data) : speciesToRepresentative(report.species);
  const extras = getConflictExtras(report.id);

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      await liveApi.generateSolutions(report!.id);
      solutions.reload();
      conflict.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRegenerating(false);
    }
  }

  async function accept() {
    if (!selected) return;
    await liveApi.accept(report!.id, selected.id);
    navigate(`/conflict/${report!.id}/agreement`);
  }

  return (
    <div className="space-y-9">
      <header>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-bold text-forest">
          <HeartHandshake size={15} /> STEP 03 · MEDIATION STUDIO
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          Find a little <span className="text-leaf">common ground.</span>
        </h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-ink/65">
          The mediator proposed these plans for <strong>{report.title}</strong>. Compare them, see them on the map,
          then negotiate with {representative.name}.
        </p>
      </header>

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-leaf/30 bg-sage/25 p-5">
          <p className="text-sm text-forest">A plan was accepted for this case, so the agreement is ready.</p>
          <Button onClick={() => navigate(`/conflict/${report.id}/agreement`)}>
            <ScrollText size={17} /> View the agreement
          </Button>
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold text-forest">01 / Explore proposed plans</h2>
          {!done && (
            <Button variant="secondary" onClick={regenerate} disabled={regenerating}>
              <RefreshCw size={16} className={regenerating ? "animate-spin" : ""} /> Ask for fresh plans
            </Button>
          )}
        </div>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {solutions.loading && !solutions.data ? (
          <LoadingState label="The mediator is drafting compromise plans…" />
        ) : solutions.error ? (
          <Card className="space-y-3">
            <p role="alert" className="text-sm text-red-700">{solutions.error}</p>
            <Button variant="secondary" onClick={solutions.reload}>Try again</Button>
          </Card>
        ) : list.length === 0 ? (
          <EmptyState title="No plans yet" description="The mediator couldn't find a plan that beats doing nothing. Try changing the report or your profile." />
        ) : (
          <div className="plan-grid grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {list.map((solution) => (
              <LivePlanCard
                key={solution.id}
                solution={solution}
                selected={solution.id === selected?.id}
                isCurrent={solution.id === tableId}
                onSelect={() => setSelectedId(solution.id)}
              />
            ))}
          </div>
        )}
      </section>

      {selected && (
        <>
          <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <LiveMap solutionId={selected.id} solutionTitle={selected.title} center={[report.lat, report.lon]} />
            <LiveIndexPanel solution={selected} />
          </section>

          {list.length > 1 && <LiveComparison solutions={list} />}

          <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            {done ? (
              <Card className="space-y-3">
                <h2 className="text-xl font-bold text-forest">Negotiation finished</h2>
                <p className="text-sm text-ink/60">This case already has an agreement. Open it to sign or review.</p>
                <Link className="font-semibold text-leaf underline" to={`/conflict/${report.id}/agreement`}>Go to the agreement</Link>
              </Card>
            ) : negotiation.loading && negotiation.data === undefined ? (
              <LoadingState compact label="Checking the negotiation table…" />
            ) : (
              <LiveNegotiation
                key={selected.id}
                conflictId={report.id}
                solution={selected}
                negotiation={negotiation.data ?? null}
                canAccept={isReporter}
                lastVerdict={lastVerdict}
                onNegotiation={(n) => {
                  negotiation.setData(n);
                  conflict.reload();
                }}
                onCounter={(result) => {
                  setLastVerdict(result);
                  setSelectedId((result.counter_solution ?? result.revision).id);
                  solutions.reload();
                  negotiation.reload();
                }}
                onAccept={accept}
              />
            )}
            <LiveRepresentative
              key={`${report.species.slug}-${selected.id}`}
              slug={report.species.slug}
              representative={representative}
              activity={extras?.observedActivity ?? "unknown"}
              topics={[{ id: "plan", label: "This plan", heading: "About this plan", statement: selected.representative_comment, mood: "hopeful" }]}
              initialTopic="plan"
              compact
            />
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to={`/conflict/${report.id}/assessment`} className="inline-flex items-center rounded-xl border border-forest/20 px-5 py-3 text-sm font-semibold text-forest hover:bg-white/60">
          Back to needs assessment
        </Link>
        {done && (
          <Button onClick={() => navigate(`/conflict/${report.id}/agreement`)}>
            Continue to agreement <ArrowRight size={18} />
          </Button>
        )}
      </div>
    </div>
  );
}
