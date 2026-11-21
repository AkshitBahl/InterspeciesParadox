
import NeedsCard from "./NeedsCard";

import type {
  HumanProfile,
  WildlifeRepresentative,
  AssessmentResult,
} from "../../types";

interface NeedsComparisonProps {
  human: HumanProfile;
  wildlife: WildlifeRepresentative;
  assessment: AssessmentResult;
}

export default function NeedsComparison({
  human,
  wildlife,
  assessment,
}: NeedsComparisonProps) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-forest">
          Meet your neighbors
        </h2>

        <p className="mt-2 text-sm text-ink/60">
          Two different perspectives. One shared space.
        </p>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <NeedsCard
          emoji={human.avatar}
          name={human.displayName || "Resident"}
          role="Human representative"
          needs={assessment.humanNeeds}
          preferences={human.preferredSolutions}
        />

        <NeedsCard
          emoji={wildlife.emoji}
          name={wildlife.name}
          role="Wildlife representative"
          needs={assessment.wildlifeNeeds}
        />
      </div>
    </section>
  );
}
