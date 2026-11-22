import type { EvaluatedPlan } from "../../types/mediation";
import ScoreRing from "../../components/ui/ScoreRing";

const dimensions = [
  ["wildlifeProtection", "Wildlife protection"],
  ["humanAccess", "Human access"],
  ["disturbanceReduction", "Disturbance reduction"],
  ["practicality", "Practicality"],
] as const;

export default function CoexistenceIndex({ result }: { result: EvaluatedPlan }) {
  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-forest">Coexistence Index</h2>
          <p className="mt-1 text-sm text-ink/60">Illustrative scores, not verified ecological predictions.</p>
        </div>
        <div className="rounded-2xl bg-sage/30 px-5 py-3 text-center">
          <ScoreRing score={result.index} />
          <div className="mt-1 text-xs text-forest/70">Weakest-link index</div>
        </div>
      </div>
      {!result.eligible && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Not eligible for this profile:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-6 space-y-4">
        {dimensions.map(([key, label]) => (
          <div key={key}>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-ink">{label}</span>
              <span className="font-semibold text-forest">{result.plan.scores[key]}/100</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sage/20">
              <div className="h-full rounded-full bg-leaf transition-all duration-300" style={{ width: `${result.plan.scores[key]}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 rounded-xl bg-cream p-4 text-xs leading-relaxed text-ink/70">
        We first reject plans that violate essential requirements. For the remaining plans, the overall index equals the <strong>lowest</strong> dimension score, so one party's wellbeing cannot be traded away for high marks elsewhere.
      </p>
    </section>
  );
}
