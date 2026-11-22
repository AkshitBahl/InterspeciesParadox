import { Accessibility, Bird, Clock, Footprints, MoveHorizontal, PawPrint, ShieldCheck, Signpost, Users, VolumeX, Wrench, type LucideIcon } from "lucide-react";
import type { EvaluatedPlan, RouteVariant } from "../../types/mediation";
import PlanTile, { type PlanChip } from "./PlanTile";
import { tidyText } from "../../utils/tidyText";

interface Props {
  result: EvaluatedPlan;
  selected: boolean;
  onSelect: () => void;
}

const routeLooks: Record<RouteVariant, { icon: LucideIcon; label: string }> = {
  protected: { icon: ShieldCheck, label: "Protected route" },
  alternative: { icon: Signpost, label: "Side route" },
  managed: { icon: Clock, label: "Managed timing" },
};

export default function PlanCard({ result, selected, onSelect }: Props) {
  const { plan, eligible, index, reasons } = result;
  const look = routeLooks[plan.route];

  const chips: PlanChip[] = [];
  if (plan.constraints.protectsNestingArea) chips.push({ icon: Bird, label: "Nest safe", hint: "Protects the nesting area" });
  chips.push(
    plan.constraints.stepFreeAccess
      ? { icon: Accessibility, label: "Step free", hint: "Step free access" }
      : { icon: Accessibility, label: "Steps", hint: "Route has steps" }
  );
  if (plan.constraints.widePassage) chips.push({ icon: MoveHorizontal, label: "Wide", hint: "Wide passage" });

  return (
    <PlanTile
      title={tidyText(plan.title)}
      kindIcon={look.icon}
      kindLabel={look.label}
      eligible={eligible}
      eligibleLabel="Demo checks pass"
      index={index}
      chips={chips}
      meters={[
        { key: "wildlife", icon: PawPrint, label: "Wildlife protection", score: plan.scores.wildlifeProtection },
        { key: "access", icon: Users, label: "Human access", score: plan.scores.humanAccess },
        { key: "calm", icon: VolumeX, label: "Less disturbance", score: plan.scores.disturbanceReduction },
        { key: "practical", icon: Wrench, label: "Practicality", score: plan.scores.practicality },
      ]}
      summary={tidyText(`${plan.subtitle}. ${plan.summary}`)}
      steps={plan.interventions.map((item, i) => ({ icon: Footprints, who: `Step ${i + 1}`, text: tidyText(item) }))}
      blockers={reasons.map(tidyText)}
      selected={selected}
      onSelect={onSelect}
      selectDisabled={!eligible}
    />
  );
}
