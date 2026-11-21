import { useState, type FormEvent } from "react";
import { BookOpen, HeartHandshake, MessageCircle, Send, ShieldQuestion, Sparkles } from "lucide-react";

import type { WildlifeActivity, WildlifeRepresentative } from "../../types";
import { liveApi } from "../../services/live/api";
import { errorMessage } from "../../services/live/client";
import type { Statement } from "../../services/live/types";
import { useLiveData } from "../../hooks/useLiveData";
import WildlifeProfile from "../wildlife/WildlifeProfile";
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
  ask: Sparkles,
};

/**
 * The species representative, speaking with the backend's words.
 * Every line comes from structured ecological data (see "Where this comes from").
 */
export default function LiveRepresentative({ slug, representative, activity, topics = [], initialTopic, compact }: Props) {
  const intro = useLiveData(`intro:${slug}`, () => liveApi.introduction(slug));
  const [topicId, setTopicId] = useState(initialTopic ?? "hello");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Statement | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [showSources, setShowSources] = useState(false);

  const allTopics: RepresentativeTopic[] = [
    { id: "hello", label: "Say hello", heading: "A little introduction", statement: intro.data, mood: "curious" },
    ...topics.filter((topic) => topic.statement),
    ...(answer ? [{ id: "ask", label: "Your question", heading: "Answering your question", statement: answer, mood: "thoughtful" as const }] : []),
  ];
  const current = allTopics.find((topic) => topic.id === topicId) ?? allTopics[0];
  const statement = current.statement;

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAskError("");
    try {
      const reply = await liveApi.ask(slug, question.trim());
      setAnswer(reply);
      setTopicId("ask");
      setQuestion("");
    } catch (error) {
      setAskError(errorMessage(error));
    } finally {
      setAsking(false);
    }
  }

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
                <p key={index}>“{line}”</p>
              ))}
            </div>
          ) : intro.error ? (
            <p className="text-sm text-amber-200">{intro.error}</p>
          ) : (
            <p className="text-sm text-sage">Listening…</p>
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

        <form onSubmit={ask} className="flex gap-2">
          <label className="sr-only" htmlFor={`ask-${slug}`}>Ask {representative.name} a question</label>
          <input
            id={`ask-${slug}`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            placeholder={`Ask ${representative.name.split(" ")[0]} something, e.g. "When will you leave?"`}
            className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-sage/70 outline-none focus:border-sage"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-forest disabled:opacity-50"
          >
            <Send size={15} aria-hidden="true" /> {asking ? "…" : "Ask"}
          </button>
        </form>
        {askError && <p role="alert" className="text-sm text-amber-200">{askError}</p>}

        <div className="flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-sage/90">
          <Sparkles size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{statement?.disclaimer ?? "The personality is fictional. Biological facts come from structured ecological data."}</p>
        </div>
      </div>
    </section>
  );
}
