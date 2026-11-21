
import { MessageCircle, Sparkles } from "lucide-react";

import type {
  WildlifeRepresentative,
  WildlifeActivity,
} from "../../types";

interface WildlifeDialogueProps {
  representative: WildlifeRepresentative;
  activity: WildlifeActivity;
}

export default function WildlifeDialogue({
  representative,
  activity,
}: WildlifeDialogueProps) {
  let message = representative.introduction;

  if (
    activity === "nesting" &&
    representative.id !== "unknown"
  ) {
    message =
      "Hey neighbor! This might be a very important " +
      "place for raising my little ones. Can we find " +
      "a way for you to go about your day while " +
      "keeping the nesting area safe?";
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-forest p-7 text-cream sm:p-9">
      <Sparkles
        className="absolute right-6 top-6 text-sage/50"
        size={28}
      />

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-4xl">
          {representative.emoji}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sage">
            Meet your wild neighbor
          </p>

          <h3 className="mt-1 text-xl font-bold">
            {representative.name}
          </h3>

          <p className="text-sm text-sage">
            {representative.personality}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white/10 p-5">
        <MessageCircle className="mb-3 text-sage" size={22} />

        <p className="text-lg leading-relaxed">
          "{message}"
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-sage/80">
        This is fictionalized dialogue representing
        illustrative ecological needs, not an
        actual communication from an animal.
      </p>
    </div>
  );
}
