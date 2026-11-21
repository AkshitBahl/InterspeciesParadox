
import Card from "../../components/ui/Card";
import type { AssessedNeed } from "../../types";

interface NeedsCardProps {
  emoji: string;
  name: string;
  role: string;
  needs: AssessedNeed[];
  preferences?: string[];
}

export default function NeedsCard({
  emoji,
  name,
  role,
  needs,
  preferences = [],
}: NeedsCardProps) {
  const essential = needs.filter(
    (need) => need.priority === "essential"
  );

  const flexible = needs.filter(
    (need) => need.priority === "preference"
  );

  return (
    <Card className="h-full space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage/30 text-4xl">
          {emoji}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-leaf">
            {role}
          </p>

          <h2 className="mt-1 text-xl font-bold text-forest">
            {name}
          </h2>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-bold text-forest">
          Essential needs
        </h3>

        <div className="space-y-3">
          {essential.map((need) => (
            <div
              key={need.id}
              className="rounded-xl border border-forest/10 bg-cream p-4"
            >
              <p className="font-semibold text-forest">
                ✓ {need.title}
              </p>

              <p className="mt-2 text-sm leading-relaxed text-ink/60">
                {need.description}
              </p>

              <span className="mt-3 inline-block rounded-full bg-sage/30 px-3 py-1 text-xs font-medium text-forest">
                Non-negotiable
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-forest/10 pt-5">
        <h3 className="mb-4 text-sm font-bold text-forest">
          Other important needs
        </h3>

        <div className="space-y-3">
          {flexible.map((need) => (
            <div
              key={need.id}
              className="rounded-xl bg-peach/20 p-4"
            >
              <p className="font-medium text-forest">
                {need.title}
              </p>

              <p className="mt-1 text-sm text-ink/60">
                {need.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {preferences.length > 0 && (
        <div className="border-t border-forest/10 pt-5">
          <h3 className="mb-3 text-sm font-bold text-forest">
            Preferred solutions
          </h3>

          <div className="flex flex-wrap gap-2">
            {preferences.map((item) => (
              <span
                key={item}
                className="rounded-full bg-sage/30 px-3 py-2 text-xs text-forest"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
