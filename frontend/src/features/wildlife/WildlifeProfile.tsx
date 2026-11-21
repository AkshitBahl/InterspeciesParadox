import { Sparkles } from "lucide-react";
import type {
  WildlifeActivity,
  WildlifeRepresentative,
} from "../../types";
import WildlifeAvatar from "./WildlifeAvatar";
import type { WildlifeMood } from "./wildlifeScript";

interface WildlifeProfileProps {
  representative: WildlifeRepresentative;
  activity: WildlifeActivity;
  mood: WildlifeMood;
}

const activityLabels: Record<WildlifeActivity, string> = {
  nesting: "Reported: nesting",
  moving: "Reported: moving",
  feeding: "Reported: feeding",
  resting: "Reported: resting",
  unknown: "Activity unconfirmed",
};

export default function WildlifeProfile({
  representative,
  activity,
  mood,
}: WildlifeProfileProps) {
  return (
    <div className="flex flex-wrap items-center gap-5 sm:flex-nowrap">
      <WildlifeAvatar representative={representative} mood={mood} />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-sage">
            <Sparkles size={12} aria-hidden="true" /> Digital representative
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-cream/80">
            {activityLabels[activity]}
          </span>
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {representative.name}
        </h3>
        <p className="mt-1 text-sm text-sage">{representative.personality}</p>
      </div>
    </div>
  );
}
