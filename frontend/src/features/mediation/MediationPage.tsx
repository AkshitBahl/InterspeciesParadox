import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, HeartHandshake, Leaf } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { demoConflict } from "../../mocks/conflicts";
import { demoPlans } from "../../mocks/plans";
import { getWildlifeRepresentative } from "../../mocks/wildlife";
import { useHumanProfile } from "../../hooks/useHumanProfile";
import { getConflictById } from "../../services/conflicts";
import { buildNeedsAssessment } from "../../services/assessments";
import { saveMediationDraft } from "../../services/mediation";
import type { PlanAdjustment } from "../../types/mediation";

import { adjustPlan, evaluatePlan } from "./mediationLogic";
import PlanCard from "./PlanCard";
import PlanComparison from "./PlanComparison";
import CoexistenceIndex from "./CoexistenceIndex";
import NegotiationPanel from "./NegotiationPanel";
import MediationMap from "./MediationMap";

import WildlifeDialogue from "../wildlife/WildlifeDialogue";

export default function MediationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useHumanProfile();
  const [selectedId, setSelectedId] = useState(demoPlans[0].id);
  const [modifications, setModifications] = useState<Record<string, PlanAdjustment[]>>({});
  const [error, setError] = useState("");

  const conflict = id === "demo" ? demoConflict : id ? getConflictById(id) : undefined;

  if (!conflict) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Conflict not found</h1>
        <Link className="font-semibold text-leaf underline" to="/conflict/new">Report a new conflict</Link>
      </Card>
    );
  }

  const supportedDemo =
    conflict.speciesId === "robin" &&
    conflict.conflictType === "access" &&
    conflict.observedActivity === "nesting";

  if (!supportedDemo) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Mediation scenario not yet available</h1>
        <p className="text-sm leading-relaxed text-ink/70">
          The frontend currently has demonstration plans for a robin nesting near a building entrance. Other animals and conflicts need species-specific rules from the backend before we can suggest plans responsibly.
        </p>
        <Link to="/conflict/demo/mediation" className="inline-block font-semibold text-leaf underline">Explore the demo mediation</Link>
      </Card>
    );
  }

  const assessment = buildNeedsAssessment(conflict, profile);
  const wildlife = getWildlifeRepresentative(conflict.speciesId);
  const results = demoPlans.map((original) => {
    const changes = modifications[original.id] ?? [];
    return evaluatePlan(adjustPlan(original, changes), profile);
  });
  const selected = results.find((result) => result.plan.id === selectedId) ?? results[0];
  const selectedAdjustments = modifications[selected.plan.id] ?? [];
  const firstEligible = results.find((result) => result.eligible);

  function saveAndContinue() {
    if (!selected.eligible || selected.index === null) return;
    try {
      saveMediationDraft({
        conflictId: conflict!.id,
        selectedPlan: selected.plan,
        coexistenceIndex: selected.index,
        adjustments: selectedAdjustments,
        savedAt: new Date().toISOString(),
      });
      navigate(`/conflict/${conflict!.id}/agreement`);
    } catch {
      setError("Unable to save this demo choice in your browser. Please try again.");
    }
  }

  return (
    <div className="space-y-9">
      <header>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-bold text-forest"><HeartHandshake size={15} /> STEP 03 — MEDIATION STUDIO</div>
        <h1 className="text-4xl font-bold tracking-tight text-forest sm:text-5xl">Find a little <span className="text-leaf">common ground.</span></h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-ink/65">Review three possible arrangements, compare how they support human and wildlife needs, then request changes to the plan you prefer.</p>
        <p className="mt-2 text-xs text-ink/50">Based on: <strong>{conflict.title}</strong> · {assessment.humanNeeds.length} human needs · {assessment.wildlifeNeeds.length} wildlife needs</p>
      </header>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-forest">01 / Explore proposed plans</h2>
        <div className="grid gap-5 xl:grid-cols-3">
          {results.map((result) => <PlanCard key={result.plan.id} result={result} selected={result.plan.id === selected.plan.id} onSelect={() => { setSelectedId(result.plan.id); setError(""); }} />)}
        </div>
        {!selected.eligible && firstEligible && (
          <button type="button" onClick={() => setSelectedId(firstEligible.plan.id)} className="mt-3 text-sm font-semibold text-leaf underline">Your selected plan no longer meets your essential requirements. Choose an eligible plan.</button>
        )}
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <MediationMap route={selected.plan.route} />
        <CoexistenceIndex result={selected} />
      </section>

      <PlanComparison results={results} />

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <NegotiationPanel
          selectedPlanTitle={selected.plan.title}
          adjustments={selectedAdjustments}
          onChange={(changes) => setModifications((previous) => ({ ...previous, [selected.plan.id]: changes }))}
        />
        <WildlifeDialogue
  key={`${wildlife.id}-${selected.plan.id}`}
  representative={wildlife}
  activity={conflict.observedActivity}
  featuredMessage={selected.plan.wildlifeMessage}
  compact
/>
      </section>

      <section className="rounded-3xl bg-sage/25 p-7 sm:p-9">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-forest"><Leaf size={25} /></div>
        <h2 className="text-2xl font-bold text-forest">02 / Save your preferred plan</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">Your selection will be stored as a <strong>draft</strong> for Step 8: the Coexistence Agreement. It is not a permit or an authorized instruction to modify an active nest.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={saveAndContinue} disabled={!selected.eligible || selected.index === null}>
            Save plan & continue <ArrowRight size={18} />
          </Button>
          <Link to={`/conflict/${conflict.id}/assessment`} className="inline-flex items-center rounded-xl border border-forest/20 px-5 py-3 text-sm font-semibold text-forest hover:bg-white/60">Back to needs assessment</Link>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {id !== "demo" && (
          <p className="mt-4 text-xs text-ink/60">This report contains only a text location, so the map above is a generic illustration. It does not show your real entrance or valid detour geometry.</p>
        )}
      </section>
    </div>
  );
}
