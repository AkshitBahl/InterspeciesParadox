import { useCountUp } from "../../hooks/useCountUp";

interface ScoreRingProps {
  /** Score out of 100, or null when there is no score (shown as a dash). */
  score: number | null;
  size?: number;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The Coexistence Index number climbing to its score inside a ring that fills up with it. */
export default function ScoreRing({ score, size = 96 }: ScoreRingProps) {
  const target = score === null ? 0 : Math.max(0, Math.min(100, score));
  const value = useCountUp(target);
  const offset = CIRCUMFERENCE * (1 - value / 100);

  return (
    <div
      role="img"
      aria-label={score === null ? "No score" : `${Math.round(target)} out of 100`}
      className="relative mx-auto"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="7" className="text-forest/10" />
        {score !== null && (
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="text-leaf"
          />
        )}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-3xl font-bold tabular-nums text-forest">{score === null ? "·" : Math.round(value)}</span>
        {score !== null && <span className="mt-1 text-[11px] font-semibold text-forest/55">/100</span>}
      </div>
    </div>
  );
}
