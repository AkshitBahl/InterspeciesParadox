import type { EvaluatedPlan } from "../../types/mediation";

const dimensions = [
  ["wildlifeProtection", "Wildlife protection"],
  ["humanAccess", "Human access"],
  ["disturbanceReduction", "Disturbance reduction"],
  ["practicality", "Practicality"],
] as const;

export default function PlanComparison({ results }: { results: EvaluatedPlan[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-forest/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-forest">Compare the compromises</h2>
      <p className="mt-2 text-sm text-ink/60">Illustrative demo values. Scores are only shown as an index when all hard constraints pass.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[590px] text-left text-sm">
          <thead><tr className="border-b border-forest/10 text-forest"><th className="py-3 pr-4">Criterion</th>{results.map(({ plan }) => <th key={plan.id} className="px-3 py-3">{plan.title}</th>)}</tr></thead>
          <tbody>
            {dimensions.map(([key, label]) => (
              <tr key={key} className="border-b border-forest/10"><th className="py-3 pr-4 font-medium text-ink/70">{label}</th>{results.map(({ plan }) => <td key={plan.id} className="px-3 py-3 tabular-nums">{plan.scores[key]}/100</td>)}</tr>
            ))}
            <tr className="font-semibold text-forest"><th className="py-3 pr-4">Coexistence Index</th>{results.map(({ plan, index }) => <td key={plan.id} className="px-3 py-3">{index === null ? "Blocked" : `${index}/100`}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
