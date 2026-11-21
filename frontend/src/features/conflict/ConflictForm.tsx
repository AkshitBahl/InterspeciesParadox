
import { useState, type FormEvent } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { wildlifeOptions } from "../../mocks/wildlife";

import type {
  ConflictDraft,
  ConflictType,
  WildlifeActivity,
} from "../../types";

interface ConflictFormProps {
  onSubmit: (draft: ConflictDraft) => void;
  isSubmitting: boolean;
}

const conflictTypes: {
  value: ConflictType;
  label: string;
}[] = [
  { value: "access", label: "Blocked or difficult access" },
  { value: "noise", label: "Noise or disturbance" },
  { value: "safety", label: "Safety concern" },
  { value: "property", label: "Property or shared-space issue" },
  { value: "other", label: "Something else" },
];

const activities: {
  value: WildlifeActivity;
  label: string;
}[] = [
  { value: "nesting", label: "Nesting or breeding" },
  { value: "moving", label: "Crossing or moving through" },
  { value: "feeding", label: "Feeding" },
  { value: "resting", label: "Resting or sheltering" },
  { value: "unknown", label: "I'm not sure" },
];

const impactOptions = [
  "Getting in or out",
  "Accessibility",
  "Daily deliveries",
  "Sleep or quiet",
  "Using shared spaces",
  "Feeling safe",
];

const initialDraft: ConflictDraft = {
  title: "",
  description: "",
  speciesId: "unknown",
  conflictType: "access",
  observedActivity: "unknown",
  location: "",
  severity: 3,
  affectedNeeds: [],
  accessBlocked: false,
};

const inputStyle =
  "w-full rounded-xl border border-forest/15 bg-cream " +
  "px-4 py-3 text-sm text-ink outline-none " +
  "focus:border-leaf focus:ring-2 focus:ring-leaf/10";

export default function ConflictForm({
  onSubmit,
  isSubmitting,
}: ConflictFormProps) {
  const [draft, setDraft] = useState<ConflictDraft>(
    initialDraft
  );
  const [error, setError] = useState("");

  function update<K extends keyof ConflictDraft>(
    key: K,
    value: ConflictDraft[K]
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleImpact(impact: string) {
    const selected = draft.affectedNeeds.includes(impact);

    update(
      "affectedNeeds",
      selected
        ? draft.affectedNeeds.filter((item) => item !== impact)
        : [...draft.affectedNeeds, impact]
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !draft.title.trim() ||
      !draft.description.trim() ||
      !draft.location.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setError("");

    onSubmit({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-9">
        {/* Section 1 */}
        <section className="space-y-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-leaf">
              01 / The situation
            </span>

            <h2 className="mt-2 text-2xl font-semibold text-forest">
              Tell us what happened.
            </h2>

            <p className="mt-2 text-sm text-ink/60">
              Every coexistence story starts somewhere.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Give your conflict a title *
            </span>

            <input
              className={inputStyle}
              required
              maxLength={100}
              placeholder="A bird is nesting near my entrance"
              value={draft.title}
              onChange={(e) =>
                update("title", e.target.value)
              }
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              What kind of conflict is it?
            </span>

            <select
              className={inputStyle}
              value={draft.conflictType}
              onChange={(e) =>
                update(
                  "conflictType",
                  e.target.value as ConflictType
                )
              }
            >
              {conflictTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Describe the situation *
            </span>

            <textarea
              className={`${inputStyle} resize-y`}
              rows={5}
              required
              maxLength={2000}
              placeholder="There's a nest beside our apartment entrance. Residents are worried about disturbing it when entering the building..."
              value={draft.description}
              onChange={(e) =>
                update("description", e.target.value)
              }
            />
          </label>
        </section>

        <div className="border-t border-forest/10" />

        {/* Section 2 */}
        <section className="space-y-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-leaf">
              02 / Your wild neighbor
            </span>

            <h2 className="mt-2 text-2xl font-semibold text-forest">
              Who are we sharing space with?
            </h2>

            <p className="mt-2 text-sm text-ink/60">
              Not sure about the species? That's okay.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Animal or species involved
            </span>

            <select
              className={inputStyle}
              value={draft.speciesId}
              onChange={(e) =>
                update("speciesId", e.target.value)
              }
            >
              {wildlifeOptions.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.emoji} {animal.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              What is the animal doing?
            </span>

            <select
              className={inputStyle}
              value={draft.observedActivity}
              onChange={(e) =>
                update(
                  "observedActivity",
                  e.target.value as WildlifeActivity
                )
              }
            >
              {activities.map((activity) => (
                <option
                  key={activity.value}
                  value={activity.value}
                >
                  {activity.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Where is the conflict happening? *
            </span>

            <input
              className={inputStyle}
              required
              maxLength={200}
              placeholder="Apartment building entrance, shared courtyard..."
              value={draft.location}
              onChange={(e) =>
                update("location", e.target.value)
              }
            />

            <span className="mt-2 block text-xs text-ink/50">
              A general location is enough for this demo.
              No private address is required.
            </span>
          </label>
        </section>

        <div className="border-t border-forest/10" />

        {/* Section 3 */}
        <section className="space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-leaf">
              03 / Your experience
            </span>

            <h2 className="mt-2 text-2xl font-semibold text-forest">
              How is this affecting you?
            </h2>

            <p className="mt-2 text-sm text-ink/60">
              Your needs matter just as much as understanding
              the wildlife's biological requirements.
            </p>
          </div>

          <div>
            <p className="mb-4 text-sm font-medium text-ink">
              What aspects of daily life are affected?
            </p>

            <div className="flex flex-wrap gap-3">
              {impactOptions.map((impact) => {
                const selected =
                  draft.affectedNeeds.includes(impact);

                return (
                  <button
                    key={impact}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleImpact(impact)}
                    className={`
                      rounded-xl border px-4 py-3
                      text-sm font-medium transition-all
                      ${
                        selected
                          ? "border-leaf bg-sage/40 text-forest"
                          : "border-forest/15 bg-white text-ink/60 hover:border-leaf"
                      }
                    `}
                  >
                    {selected ? "✓ " : "+ "}
                    {impact}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label
                htmlFor="severity"
                className="text-sm font-medium"
              >
                How disruptive is this situation?
              </label>

              <span className="font-semibold text-leaf">
                {draft.severity}/5
              </span>
            </div>

            <input
              id="severity"
              type="range"
              min="1"
              max="5"
              value={draft.severity}
              onChange={(e) =>
                update("severity", Number(e.target.value))
              }
              className="w-full accent-leaf"
            />

            <div className="mt-2 flex justify-between text-xs text-ink/50">
              <span>Minor inconvenience</span>
              <span>Major disruption</span>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-sage/15 p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-leaf"
              checked={draft.accessBlocked}
              onChange={(e) =>
                update("accessBlocked", e.target.checked)
              }
            />

            <span className="text-sm text-forest">
              My regular entrance or exit is currently
              blocked or unusable.
            </span>
          </label>

          {draft.accessBlocked && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <AlertTriangle
                size={20}
                className="shrink-0"
              />

              <p>
                If safe access is unavailable, contact
                your building manager or local emergency
                services as appropriate. Do not attempt
                to move or disturb protected wildlife.
              </p>
            </div>
          )}
        </section>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="border-t border-forest/10 pt-6">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting
              ? "Submitting..."
              : "Submit conflict report"}
            <ArrowRight size={18} />
          </Button>

          <p className="mt-3 text-xs text-ink/50">
            Your report will be saved in this browser
            for the prototype.
          </p>
        </div>
      </form>
    </Card>
  );
}
