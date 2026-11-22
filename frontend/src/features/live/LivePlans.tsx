import {
  Building2,
  CircleDashed,
  Clock,
  Euro,
  Eye,
  Fence,
  Gauge,
  Handshake,
  HardHat,
  House,
  Landmark,
  Leaf,
  Microscope,
  Moon,
  PawPrint,
  Route,
  Scale,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Solution } from "../../services/live/types";
import { isEligible, partyLabel, planBlockers } from "../../services/live/adapters";
import ScoreRing from "../../components/ui/ScoreRing";
import PlanTile, { type PlanChip } from "../mediation/PlanTile";
import { tidyText } from "../../utils/tidyText";

const strategyLooks: Record<string, { icon: LucideIcon; label: string }> = {
  seasonal_quiet_zone: { icon: CircleDashed, label: "Quiet zone" },
  screen_mitigation: { icon: Fence, label: "Screen" },
  schedule_shift: { icon: Clock, label: "New timing" },
  alternative_habitat: { icon: House, label: "New home" },
  dark_corridor: { icon: Moon, label: "Dark corridor" },
  safe_passage: { icon: Route, label: "Safe passage" },
  watch_and_adapt: { icon: Eye, label: "Watch and adapt" },
};

const originTags: Record<string, { icon: LucideIcon; label: string }> = {
  generated: { icon: Sparkles, label: "Mediator's proposal" },
  human_revision: { icon: UserRound, label: "Your counter proposal" },
  representative_counter: { icon: PawPrint, label: "Representative's counter offer" },
};

const partyIcons: Record<string, LucideIcon> = {
  reporter: UserRound,
  residents: Users,
  building_manager: Building2,
  contractor: HardHat,
  ecologist: Microscope,
  delivery_operator: Truck,
  city: Landmark,
  species_representative: PawPrint,
};

const meterIcons: Record<string, LucideIcon> = {
  wildlife_wellbeing: PawPrint,
  human_wellbeing: Users,
  feasibility: Wrench,
  balance: Scale,
};

interface CardProps {
  solution: Solution;
  selected: boolean;
  onSelect: () => void;
  isCurrent?: boolean;
}

export function LivePlanCard({ solution, selected, onSelect, isCurrent }: CardProps) {
  const eligible = isEligible(solution);
  const index = solution.index_breakdown;
  const look = strategyLooks[solution.strategy] ?? { icon: Leaf, label: tidyText(solution.strategy.replace(/_/g, " ")) };

  const chips: PlanChip[] = [];
  if (solution.cost_eur !== null) chips.push({ icon: Euro, label: String(solution.cost_eur), hint: "Cost in euro" });
  if (solution.effort) chips.push({ icon: Gauge, label: solution.effort.replace(/^\w/, (c) => c.toUpperCase()), hint: "Effort" });
  if (isCurrent) chips.push({ icon: Handshake, label: "On the table", hint: "Being negotiated now" });

  return (
    <PlanTile
      title={tidyText(solution.title)}
      kindIcon={look.icon}
      kindLabel={`${look.label}${solution.version > 1 ? ` v${solution.version}` : ""}`}
      tag={originTags[solution.origin] ?? { icon: Sparkles, label: "Compromise option" }}
      eligible={eligible}
      eligibleLabel="All rules pass"
      index={solution.coexistence_index}
      grade={index?.grade}
      chips={chips}
      meters={(index?.components ?? []).map((component) => ({
        key: component.key,
        icon: meterIcons[component.key] ?? Leaf,
        label: component.label,
        score: component.score,
      }))}
      summary={tidyText(solution.summary)}
      steps={solution.actions.map((action) => ({
        icon: partyIcons[action.party] ?? UserRound,
        who: partyLabel(action.party),
        text: tidyText(action.action),
        when: action.when ? tidyText(action.when) : null,
      }))}
      blockers={planBlockers(solution).map(tidyText)}
      selected={selected}
      onSelect={onSelect}
    />
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
          <ScoreRing score={index.index} />
          <div className="mt-1 text-xs text-forest/70">{index.raw_index !== index.index ? `Capped from ${Math.round(index.raw_index)}` : "Weighted score"}</div>
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
                  return <td key={s.id} className="px-3 py-3 tabular-nums">{c ? Math.round(c.score) : "·"}</td>;
                })}
              </tr>
            ))}
            <tr className="border-b border-forest/10">
              <th className="py-3 pr-4 font-medium text-ink/70">Cost</th>
              {solutions.map((s) => <td key={s.id} className="px-3 py-3 tabular-nums">{s.cost_eur !== null ? `${s.cost_eur} EUR` : "·"}</td>)}
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
