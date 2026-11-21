import type { PlanAdjustment } from "../../types/mediation";

const choices: { id: PlanAdjustment; label: string; description: string }[] = [
  { id: "delivery-window", label: "Request a designated delivery window", description: "Try reducing interruptions near the habitat. This may add coordination work." },
  { id: "accessible-signs", label: "Request accessible wayfinding", description: "Add high-contrast signs to make the suggested route clearer." },
];

interface Props {
  selectedPlanTitle: string;
  adjustments: PlanAdjustment[];
  onChange: (items: PlanAdjustment[]) => void;
}

export default function NegotiationPanel({ selectedPlanTitle, adjustments, onChange }: Props) {
  return (
    <section className="rounded-3xl border border-forest/10 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-forest">Negotiate your compromise</h2>
      <p className="mt-2 text-sm text-ink/60">Selected: <strong>{selectedPlanTitle}</strong>. Request modifications and watch the mock index update.</p>
      <div className="mt-5 space-y-3">
        {choices.map((option) => (
          <label key={option.id} className="flex cursor-pointer gap-3 rounded-2xl border border-forest/10 bg-cream p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-leaf"
              checked={adjustments.includes(option.id)}
              onChange={(event) => onChange(event.target.checked ? [...adjustments, option.id] : adjustments.filter((item) => item !== option.id))}
            />
            <span><span className="block text-sm font-semibold text-forest">{option.label}</span><span className="mt-1 block text-xs text-ink/60">{option.description}</span></span>
          </label>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink/60">These are requests for later review, not approved modifications. An ecological specialist and relevant authorities must verify any real intervention.</p>
    </section>
  );
}
