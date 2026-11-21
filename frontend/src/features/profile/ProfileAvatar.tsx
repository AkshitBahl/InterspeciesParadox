
import type { ProfileAccent } from "../../types";

interface ProfileAvatarProps {
  avatar: string;
  accent: ProfileAccent;
  onAvatarChange: (avatar: string) => void;
  onAccentChange: (accent: ProfileAccent) => void;
}

const avatars = ["🧑‍🚀", "🧑‍🎨", "🧑‍🌾", "🧑‍🔬"];

const accents: {
  value: ProfileAccent;
  className: string;
}[] = [
  { value: "forest", className: "bg-forest" },
  { value: "sage", className: "bg-sage" },
  { value: "peach", className: "bg-peach" },
];

export default function ProfileAvatar({
  avatar,
  accent,
  onAvatarChange,
  onAccentChange,
}: ProfileAvatarProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-forest">
          Choose your avatar
        </h3>
        <p className="mt-1 text-sm text-ink/60">
          How should your digital self appear?
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {avatars.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`Choose avatar ${option}`}
            aria-pressed={avatar === option}
            onClick={() => onAvatarChange(option)}
            className={`
              flex h-16 w-16 items-center justify-center
              rounded-2xl border-2 text-3xl transition-all
              hover:scale-105
              ${
                avatar === option
                  ? "border-leaf bg-sage/30 shadow-md"
                  : "border-forest/10 bg-cream"
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-3 font-semibold text-forest">
          Profile color
        </h3>

        <div className="flex gap-3">
          {accents.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={`Choose ${option.value} profile color`}
              aria-pressed={accent === option.value}
              onClick={() => onAccentChange(option.value)}
              className={`
                h-10 w-10 rounded-full border-2
                transition-transform hover:scale-110
                ${option.className}
                ${
                  accent === option.value
                    ? "ring-2 ring-leaf ring-offset-4"
                    : "border-transparent"
                }
              `}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
