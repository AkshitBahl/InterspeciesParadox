
import {
  MapPin,
  CalendarDays,
  AlertCircle,
} from "lucide-react";

import Card from "../../components/ui/Card";
import { wildlifeOptions } from "../../mocks/wildlife";
import type { ConflictReport } from "../../types";

interface ConflictCardProps {
  conflict: ConflictReport;
  /** Live mode: the species as the backend names it. */
  species?: { name: string; emoji: string };
  statusLabel?: string;
}

export default function ConflictCard({
  conflict,
  species,
  statusLabel = "Reported",
}: ConflictCardProps) {
  const animal = species ?? wildlifeOptions.find(
    (item) => item.id === conflict.speciesId
  );

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-leaf">
            Conflict report
          </span>

          <h2 className="mt-2 text-2xl font-bold text-forest">
            {conflict.title}
          </h2>
        </div>

        <span className="rounded-full bg-sage/40 px-3 py-1.5 text-xs font-semibold text-forest">
          {statusLabel}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink/70">
        {conflict.description}
      </p>

      <div className="grid gap-4 border-t border-forest/10 pt-5 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {animal?.emoji ?? "🐾"}
          </span>

          <div>
            <p className="text-xs text-ink/50">
              Wild neighbor
            </p>
            <p className="text-sm font-medium text-forest">
              {animal?.name ?? "Unknown species"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <MapPin className="text-leaf" size={20} />

          <div>
            <p className="text-xs text-ink/50">
              Location
            </p>
            <p className="text-sm font-medium text-forest">
              {conflict.location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AlertCircle className="text-leaf" size={20} />

          <div>
            <p className="text-xs text-ink/50">
              Disruption
            </p>
            <p className="text-sm font-medium text-forest">
              {conflict.severity}/5
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CalendarDays className="text-leaf" size={20} />

          <div>
            <p className="text-xs text-ink/50">
              Reported on
            </p>
            <p className="text-sm font-medium text-forest">
              {new Date(
                conflict.createdAt
              ).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {conflict.affectedNeeds.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-forest/10 pt-5">
          {conflict.affectedNeeds.map((need) => (
            <span
              key={need}
              className="rounded-full bg-peach/40 px-3 py-2 text-xs text-forest"
            >
              {need}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
