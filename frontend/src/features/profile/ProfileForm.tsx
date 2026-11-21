
import type { HumanProfile } from "../../types";

interface ProfileFormProps {
  profile: HumanProfile;
  onChange: (profile: HumanProfile) => void;
}

type ListField =
  | "accessNeeds"
  | "dailyRoutines"
  | "preferredSolutions";

const groups: {
  title: string;
  description: string;
  field: ListField;
  options: string[];
}[] = [
  {
    title: "Accessibility requirements",
    description: "These are treated as essential needs.",
    field: "accessNeeds",
    options: [
      "Step-free route",
      "No stairs",
      "Wide passage",
    ],
  },
  {
    title: "Daily routines",
    description: "Help the mediator understand your lifestyle.",
    field: "dailyRoutines",
    options: [
      "Morning commute",
      "Daily deliveries",
      "Late-night returns",
      "Outdoor activities",
    ],
  },
  {
    title: "Preferred solutions",
    description: "What kinds of compromises do you prefer?",
    field: "preferredSolutions",
    options: [
      "Temporary barriers",
      "Alternative routes",
      "Quiet-hour scheduling",
      "Clear signage",
    ],
  },
];

export default function ProfileForm({
  profile,
  onChange,
}: ProfileFormProps) {
  function toggleOption(field: ListField, value: string) {
    const current = profile[field];

    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    onChange({
      ...profile,
      [field]: updated,
    });
  }

  return (
    <div className="space-y-8">
      {/* Personal information */}
      <section className="space-y-5">
        <div>
          <h3 className="text-xl font-semibold text-forest">
            About you
          </h3>
          <p className="text-sm text-ink/60">
            Tell your neighbors a little about yourself.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Display name
          </span>

          <input
            type="text"
            value={profile.displayName}
            onChange={(e) =>
              onChange({
                ...profile,
                displayName: e.target.value,
              })
            }
            className="w-full rounded-xl border border-forest/15 bg-cream p-3 outline-none focus:border-leaf"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Your introduction
          </span>

          <textarea
            value={profile.bio}
            rows={3}
            onChange={(e) =>
              onChange({
                ...profile,
                bio: e.target.value,
              })
            }
            className="w-full resize-none rounded-xl border border-forest/15 bg-cream p-3 outline-none focus:border-leaf"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Your living space
          </span>

          <select
            value={profile.homeType}
            onChange={(e) =>
              onChange({
                ...profile,
                homeType: e.target.value as HumanProfile["homeType"],
              })
            }
            className="w-full rounded-xl border border-forest/15 bg-cream p-3 outline-none focus:border-leaf"
          >
            <option>Apartment</option>
            <option>House</option>
            <option>Shared building</option>
          </select>
        </label>
      </section>

      {/* Non-negotiable needs */}
      <section>
        <h3 className="text-xl font-semibold text-forest">
          Your essential needs
        </h3>

        <p className="mb-4 mt-2 text-sm text-ink/60">
          These requirements cannot be traded away
          during negotiation.
        </p>

        <div className="flex flex-wrap gap-2">
          {profile.essentialNeeds.map((need) => (
            <span
              key={need}
              className="rounded-full bg-sage/40 px-4 py-2 text-sm font-medium text-forest"
            >
              ✓ {need}
            </span>
          ))}
        </div>
      </section>

      {/* Customizable options */}
      {groups.map((group) => (
        <section key={group.field}>
          <h3 className="text-xl font-semibold text-forest">
            {group.title}
          </h3>

          <p className="mb-4 mt-2 text-sm text-ink/60">
            {group.description}
          </p>

          <div className="flex flex-wrap gap-3">
            {group.options.map((option) => {
              const selected =
                profile[group.field].includes(option);

              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    toggleOption(group.field, option)
                  }
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
                  {option}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* Personal priorities */}
      <section>
        <h3 className="text-xl font-semibold text-forest">
          Your personal priorities
        </h3>

        <p className="mt-2 text-sm text-ink/60">
          These influence soft preferences, never
          wildlife protection or safety requirements.
        </p>

        {(
          [
            ["minimizeDetours", "Minimizing detours"],
            ["quietEnvironment", "Keeping things quiet"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="mt-6">
            <div className="mb-3 flex justify-between">
              <span className="text-sm font-medium">
                {label}
              </span>

              <span className="text-sm text-leaf">
                {profile.priorities[key]}/5
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="5"
              value={profile.priorities[key]}
              aria-label={label}
              onChange={(e) =>
                onChange({
                  ...profile,
                  priorities: {
                    ...profile.priorities,
                    [key]: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-leaf"
            />
          </div>
        ))}
      </section>
    </div>
  );
}
