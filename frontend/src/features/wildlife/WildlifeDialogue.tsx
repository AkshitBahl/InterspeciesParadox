import { useState } from "react";
import {
  HeartHandshake,
  MessageCircle,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type {
  WildlifeActivity,
  WildlifeRepresentative,
} from "../../types";
import WildlifeProfile from "./WildlifeProfile";
import { getWildlifeLine, type DialogueTopic } from "./wildlifeScript";

interface WildlifeDialogueProps {
  representative: WildlifeRepresentative;
  activity: WildlifeActivity;
  /** Selected plan's story response, already provided by the mock mediation data. */
  featuredMessage?: string;
  /** Slightly smaller layout for the Mediation Studio column. */
  compact?: boolean;
}

const defaultTopics = [
  { id: "welcome", label: "Say hello", icon: MessageCircle },
  { id: "needs", label: "My needs", icon: ShieldQuestion },
  { id: "worries", label: "My concerns", icon: TriangleAlert },
  { id: "compromise", label: "Common ground", icon: HeartHandshake },
] as const;

export default function WildlifeDialogue({
  representative,
  activity,
  featuredMessage,
  compact = false,
}: WildlifeDialogueProps) {
  const [topic, setTopic] = useState<DialogueTopic>(
    featuredMessage ? "plan" : "welcome"
  );
  const line = getWildlifeLine(representative, activity, topic, featuredMessage);
  const topics: { id: DialogueTopic; label: string; icon: typeof MessageCircle }[] = [
    ...defaultTopics,
    ...(featuredMessage
      ? [{ id: "plan" as const, label: "This plan", icon: Sparkles }]
      : []),
  ];

  return (
    <section
      aria-label={`Conversation with ${representative.name}`}
      className={`relative overflow-hidden rounded-3xl bg-forest text-cream shadow-lg shadow-forest/10 ${compact ? "p-5 sm:p-6" : "p-6 sm:p-9"}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sage/10 blur-3xl" />
      <div className="relative z-10 space-y-6">
        <WildlifeProfile representative={representative} activity={activity} mood={line.mood} />

        <div className="flex flex-wrap gap-2" aria-label="Questions for the wildlife representative">
          {topics.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={topic === id}
              onClick={() => setTopic(id)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                topic === id
                  ? "bg-cream text-forest shadow-sm"
                  : "border border-white/20 bg-white/10 text-cream hover:bg-white/20"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div
          key={`${representative.id}-${topic}-${featuredMessage ?? ""}`}
          className="kinship-dialogue-appear relative rounded-2xl border border-white/15 bg-white/10 p-5 sm:p-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="absolute -top-2 left-9 h-4 w-4 rotate-45 border-l border-t border-white/15 bg-[#31564b]" aria-hidden="true" />
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-sage">
            {line.heading}
          </p>
          <p className="text-base leading-relaxed text-white sm:text-lg">
            “{line.message}”
          </p>
        </div>

        <div className="flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-sage/90">
          <Sparkles size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Playful fictional dialogue, not an animal's actual words or consent.
            Ecological requirements and plan feasibility must be checked independently.
          </p>
        </div>
      </div>
    </section>
  );
}
