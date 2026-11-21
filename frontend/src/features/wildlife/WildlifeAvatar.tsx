import type { WildlifeRepresentative } from "../../types";
import type { WildlifeMood } from "./wildlifeScript";

interface WildlifeAvatarProps {
  representative: WildlifeRepresentative;
  mood?: WildlifeMood;
  size?: "small" | "large";
}

const sizes = {
  small: "h-16 w-16 text-4xl",
  large: "h-24 w-24 text-6xl sm:h-28 sm:w-28",
};

const moodStyle: Record<WildlifeMood, string> = {
  curious: "from-sage/80 via-white/25 to-cream/20",
  thoughtful: "from-peach/70 via-white/25 to-sage/30",
  concerned: "from-amber-200/75 via-white/25 to-peach/50",
  hopeful: "from-emerald-200/80 via-white/25 to-sage/40",
};

export default function WildlifeAvatar({
  representative,
  mood = "curious",
  size = "large",
}: WildlifeAvatarProps) {
  return (
    <div
      role="img"
      aria-label={`${representative.name}, illustrated wildlife avatar, ${mood} mood`}
      className={`kinship-wildlife-avatar relative flex shrink-0 items-center justify-center rounded-[1.8rem] bg-gradient-to-br shadow-lg shadow-black/10 ring-1 ring-white/30 ${sizes[size]} ${moodStyle[mood]}`}
    >
      <span aria-hidden="true" className="kinship-wildlife-emoji relative z-10 select-none">
        {representative.emoji}
      </span>
      <span aria-hidden="true" className="absolute left-2 top-2 h-3 w-3 rounded-full bg-white/35" />
      <span aria-hidden="true" className="absolute bottom-3 right-2 h-2 w-2 rounded-full bg-white/45" />
    </div>
  );
}
