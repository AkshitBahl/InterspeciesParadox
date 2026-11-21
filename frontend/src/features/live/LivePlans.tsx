import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { Solution } from "../../services/live/types";
import { isEligible, partyLabel, planBlockers } from "../../services/live/adapters";

const originLabels: Record<string, string> = {
  generated: "Mediator's proposal",
  human_revision: "Your counter-proposal",
  representative_counter: "Representative's counter-offer",
};

interface CardProps {
  solution: Solution;
  selected: boolean;
  onSelect: () => void;
  isCurrent?: boolean;
}

export function LivePlanCard({ solution, selected, onSelect, isCurrent }: CardProps) {
  const eligible = isEligible(solution);
  const blockers = planBlockers(solution);
  const index = solution.index_breakdown;

  return (
    <article className={`flex h-full flex-col rounded-3xl border bg-white p-5 shadow-sm transition-all ${selected ? "border-leaf ring-2 ring-leaf/20" : "border-forest/10"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-leaf">
          {originLabels[solution.origin] ?? "Compromise option"}{solution.version > 1 ? ` · v${solution.version}` : ""}
        </span>
        {eligible ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sage/30 px-3 py-1 text-xs text-forest"><CheckCircle2 size={13} /> All rules pass</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"><ShieldAlert size={13} /> Blocked</span>
        )}
      </div>
      <h3 className="mt-4 text-xl font-bold text-forest">{solution.title}</h3>
      <p className="mt-1 text-sm font-medium text-leaf">
        {solution.strategy.replace(/_/g, " ")}
        {solution.cost_eur !== null ? ` · ${solution.cost_eur} EUR` : ""}
        {solution.effort ? ` · ${solution.effort} effort` : ""}
        {isCurrent ? " · on the table" : ""}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">{solution.summary}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-ink/80">
        {solution.actions.map((action, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-leaf">✓</span>
            <span>
              <strong className="font-semibold text-forest">{partyLabel(action.party)}:</strong> {action.action}
              {action.when ? <span className="text-ink/50"> ({action.when})</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {blockers.length > 0 && <p className="mt-4 text-sm text-amber-800">{blockers.join(" ")}</p>}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-forest/10 pt-5">
        <div>
          <p className="text-xs text-ink/60">Coexistence Index</p>
          <p className="text-2xl font-bold text-forest">
            {Math.round(solution.coexistence_index)}/100 <span className="text-base" aria-hidden="true">{index?.emoji}</span>
          </p>
          <p className="text-xs text-ink/50">{index?.grade}</p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${selected ? "bg-sage/40 text-forest" : "bg-forest text-white hover:bg-leaf"}`}
        >
          {selected ? "Selected" : "Explore plan"}
        </button>
      </div>
    </article>
  );
}

export function LiveIndexPanel({ solution }: { solution: Solution }) {
  const index = solution.index_breakdown;
  const blockers = planBlockers(solution);

  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-forest">Coexistence Index</h2>
          <p className="mt-1 text-sm text-ink/60">{index.grade} {index.emoji}</p>
        </div>
        <div className="rounded-2xl bg-sage/30 px-5 py-3 text-center">
          <div className="text-3xl font-bold text-forest">{Math.round(index.index)}/100</div>
          <div className="text-xs text-forest/70">{index.raw_index !== index.index ? `Capped from ${Math.round(index.raw_index)}` : "Weighted score"}</div>
        </div>
      </div>
      {blockers.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Why this plan is held back:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-6 space-y-4">
        {index.components.map((component) => (
          <div key={component.key}>
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{component.label} <span className="text-ink/40">× {component.weight}</span></span>
              <span className="font-semibold text-forest">{Math.round(component.score)}/100</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sage/20">
              <div className="h-full rounded-full bg-leaf transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, component.score))}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink/50">{component.explanation}</p>
          </div>
        ))}
      </div>
      {solution.tradeoffs.length > 0 && (
        <div className="mt-5 text-sm text-ink/70">
          <p className="font-semibold text-forest">Trade-offs</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {solution.tradeoffs.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-5 rounded-xl bg-cream p-4 text-xs leading-relaxed text-ink/70">
        {index.formula}. Breaking a legal rule caps the index at 39, going below the ecological minimum or a hard
        human need caps it at 49.
      </p>
    </section>
  );
}

export function LiveComparison({ solutions }: { solutions: Solution[] }) {
  const rows = solutions[0]?.index_breakdown.components ?? [];
  return (
    <section className="overflow-hidden rounded-3xl border border-forest/10 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-forest">Compare the compromises</h2>
      <p className="mt-2 text-sm text-ink/60">Scores from the mediation backend, out of 100.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[590px] text-left text-sm">
          <thead>
            <tr className="border-b border-forest/10 text-forest">
              <th className="py-3 pr-4">Criterion</th>
              {solutions.map((s) => <th key={s.id} className="px-3 py-3">{s.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-forest/10">
                <th className="py-3 pr-4 font-medium text-ink/70">{row.label}</th>
                {solutions.map((s) => {
                  const c = s.index_breakdown.components.find((x) => x.key === row.key);
                  return <td key={s.id} className="px-3 py-3 tabular-nums">{c ? Math.round(c.score) : "—"}</td>;
                })}
              </tr>
            ))}
            <tr className="border-b border-forest/10">
              <th className="py-3 pr-4 font-medium text-ink/70">Cost</th>
              {solutions.map((s) => <td key={s.id} className="px-3 py-3 tabular-nums">{s.cost_eur !== null ? `${s.cost_eur} EUR` : "—"}</td>)}
            </tr>
            <tr className="font-semibold text-forest">
              <th className="py-3 pr-4">Coexistence Index</th>
              {solutions.map((s) => <td key={s.id} className="px-3 py-3">{isEligible(s) ? Math.round(s.coexistence_index) : `Blocked (${Math.round(s.coexistence_index)})`}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
