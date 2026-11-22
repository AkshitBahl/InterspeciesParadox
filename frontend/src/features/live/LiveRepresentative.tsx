import { useState } from "react";
import { BookOpen, HeartHandshake, MessageCircle, ShieldQuestion, Sparkles } from "lucide-react";

import type { WildlifeActivity, WildlifeRepresentative } from "../../types";
import { liveApi } from "../../services/live/api";
import type { Statement } from "../../services/live/types";
import { useLiveData } from "../../hooks/useLiveData";
import LeafSpinner from "../../components/ui/LeafSpinner";
import WildlifeProfile from "../wildlife/WildlifeProfile";
import { tidyText } from "../../utils/tidyText";
import type { WildlifeMood } from "../wildlife/wildlifeScript";

export interface RepresentativeTopic {
  id: string;
  label: string;
  heading: string;
  statement: Statement | null | undefined;
  mood?: WildlifeMood;
}

interface Props {
  slug: string;
  representative: WildlifeRepresentative;
  activity: WildlifeActivity;
  /** Extra things the representative has said on this page (needs, plan review...). */
  topics?: RepresentativeTopic[];
  initialTopic?: string;
  compact?: boolean;
}

const icons: Record<string, typeof MessageCircle> = {
  hello: MessageCircle,
  needs: ShieldQuestion,
  plan: HeartHandshake,
};

/**
 * The species representative, speaking with the backend's words.
 * Every line comes from structured ecological data (see "Where this comes from").
 */
export default function LiveRepresentative({ slug, representative, activity, topics = [], initialTopic, compact }: Props) {
  const intro = useLiveData(`intro:${slug}`, () => liveApi.introduction(slug));
  const [topicId, setTopicId] = useState(initialTopic ?? "hello");
  const [showSources, setShowSources] = useState(false);

  const allTopics: RepresentativeTopic[] = [
    { id: "hello", label: "Say hello", heading: "A little introduction", statement: intro.data, mood: "curious" },
    ...topics.filter((topic) => topic.statement),
  ];
  const current = allTopics.find((topic) => topic.id === topicId) ?? allTopics[0];
  const statement = current.statement;

  return (
    <section
      aria-label={`Conversation with ${representative.name}`}
      className={`relative overflow-hidden rounded-3xl bg-forest text-cream shadow-lg shadow-forest/10 ${compact ? "p-5 sm:p-6" : "p-6 sm:p-9"}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sage/10 blur-3xl" />
      <div className="relative z-10 space-y-6">
        <WildlifeProfile representative={representative} activity={activity} mood={current.mood ?? "thoughtful"} />

        <div className="flex flex-wrap gap-2" aria-label="Topics">
          {allTopics.map((topic) => {
            const Icon = icons[topic.id] ?? ShieldQuestion;
            return (
              <button
                key={topic.id}
                type="button"
                aria-pressed={current.id === topic.id}
                onClick={() => setTopicId(topic.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  current.id === topic.id ? "bg-cream text-forest shadow-sm" : "border border-white/20 bg-white/10 text-cream hover:bg-white/20"
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {topic.label}
              </button>
            );
          })}
        </div>

        <div
          key={`${current.id}-${statement?.text ?? ""}`}
          className="kinship-dialogue-appear relative rounded-2xl border border-white/15 bg-white/10 p-5 sm:p-6"
          role="status"
          aria-live="polite"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-sage">{current.heading}</p>
          {statement ? (
            <div className="space-y-2 text-base leading-relaxed text-white sm:text-lg">
              {statement.lines.map((line, index) => (
                <p key={index}>“{tidyText(line)}”</p>
              ))}
            </div>
          ) : intro.error ? (
            <p className="text-sm text-amber-200">{intro.error}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-sage"><LeafSpinner size={18} /> Listening…</p>
          )}

          {statement?.grounding && statement.grounding.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                aria-expanded={showSources}
                className="inline-flex items-center gap-2 text-xs font-semibold text-sage hover:text-white"
              >
                <BookOpen size={13} aria-hidden="true" /> Where this comes from ({statement.grounding.length})
              </button>
              {showSources && (
                <ul className="mt-2 space-y-1 text-xs text-cream/80">
                  {statement.grounding.map((item, index) => (
                    <li key={index}>
                      {item.claim} <span className="text-sage/70">· {item.source}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>


        <div className="flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-sage/90">
          <Sparkles size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{statement?.disclaimer ?? "The personality is fictional. Biological facts come from structured ecological data."}</p>
        </div>
      </div>
    </section>
  );
}
