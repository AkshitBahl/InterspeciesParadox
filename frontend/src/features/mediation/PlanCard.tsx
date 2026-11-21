import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { EvaluatedPlan } from "../../types/mediation";

interface Props {
  result: EvaluatedPlan;
  selected: boolean;
  onSelect: () => void;
}

export default function PlanCard({ result, selected, onSelect }: Props) {
  const { plan, eligible, index, reasons } = result;

  return (
    <article className={`flex h-full flex-col rounded-3xl border bg-white p-5 shadow-sm transition-all ${selected ? "border-leaf ring-2 ring-leaf/20" : "border-forest/10"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-leaf">Compromise option</span>
        {eligible ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sage/30 px-3 py-1 text-xs text-forest"><CheckCircle2 size={13} /> Demo checks pass</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"><ShieldAlert size={13} /> Blocked</span>
        )}
      </div>
      <h3 className="mt-4 text-xl font-bold text-forest">{plan.title}</h3>
      <p className="mt-1 text-sm font-medium text-leaf">{plan.subtitle}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink/70">{plan.summary}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-ink/80">
        {plan.interventions.map((item) => <li key={item} className="flex gap-2"><span className="text-leaf">✓</span><span>{item}</span></li>)}
      </ul>
      {reasons.length > 0 && <p className="mt-4 text-sm text-amber-800">{reasons.join(" ")}</p>}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-forest/10 pt-5">
        <div><p className="text-xs text-ink/60">Coexistence Index</p><p className="text-2xl font-bold text-forest">{index === null ? "—" : `${index}/100`}</p></div>
        <button type="button" disabled={!eligible} onClick={onSelect} aria-pressed={selected} className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "bg-sage/40 text-forest" : "bg-forest text-white hover:bg-leaf"}`}>
          {selected ? "Selected" : "Explore plan"}
        </button>
      </div>
    </article>
  );
}
