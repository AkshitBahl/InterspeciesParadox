import { useId, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, CheckCircle2, ChevronDown, ShieldAlert } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import { useTilt } from "../../motion/useTilt";
import "./planTile.css";

export interface PlanChip {
  icon: LucideIcon;
  label: string;
  /** What the chip means, read by screen readers and shown on hover. */
  hint: string;
}

export interface PlanMeter {
  key: string;
  icon: LucideIcon;
  label: string;
  score: number;
}

export interface PlanStep {
  icon: LucideIcon;
  who: string;
  text: string;
  when?: string | null;
}

interface Props {
  title: string;
  kindIcon: LucideIcon;
  kindLabel: string;
  tag?: { icon: LucideIcon; label: string };
  eligible: boolean;
  eligibleLabel: string;
  index: number | null;
  grade?: string;
  chips: PlanChip[];
  meters: PlanMeter[];
  summary: string;
  steps: PlanStep[];
  blockers: string[];
  selected: boolean;
  onSelect: () => void;
  selectDisabled?: boolean;
}

const RADIUS = 27;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function IndexRing({ score, grade }: { score: number | null; grade?: string }) {
  const target = score === null ? 0 : Math.max(0, Math.min(100, score));
  const value = useCountUp(target);
  return (
    <div className="plan-ring tilt-pop" role="img" aria-label={score === null ? "No Coexistence Index" : `Coexistence Index ${Math.round(target)} out of 100${grade ? `, ${grade}` : ""}`} title={grade}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={RADIUS} className="plan-ring-track" />
        {score !== null && (
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            className="plan-ring-fill"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
          />
        )}
      </svg>
      <span aria-hidden="true">{score === null ? "?" : Math.round(value)}</span>
    </div>
  );
}

/**
 * One compromise plan, shown as a small visual card: an icon for the kind of plan,
 * the Coexistence Index ring, a few chips and four score bars. The words (summary and
 * who does what) wait behind "Steps", so nothing is lost.
 */
export default function PlanTile({
  title,
  kindIcon: KindIcon,
  kindLabel,
  tag,
  eligible,
  eligibleLabel,
  index,
  grade,
  chips,
  meters,
  summary,
  steps,
  blockers,
  selected,
  onSelect,
  selectDisabled,
}: Props) {
  const tiltRef = useTilt<HTMLElement>();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const TagIcon = tag?.icon;

  return (
    <article ref={tiltRef} className={`plan-tile ${selected ? "is-selected" : ""} ${eligible ? "" : "is-blocked"}`}>
      <div className="plan-tile-top">
        <span className="plan-kind tilt-pop" aria-hidden="true">
          <KindIcon size={22} strokeWidth={1.7} />
        </span>
        <div className="plan-flags">
          {tag && TagIcon && (
            <span className="plan-flag" title={tag.label}>
              <TagIcon size={13} aria-hidden="true" />
              <span className="sr-only">{tag.label}</span>
            </span>
          )}
          <span className={`plan-flag ${eligible ? "is-pass" : "is-blocked"}`} title={eligible ? eligibleLabel : "Blocked by a rule"}>
            {eligible ? <CheckCircle2 size={13} aria-hidden="true" /> : <ShieldAlert size={13} aria-hidden="true" />}
            <span>{eligible ? "Pass" : "Blocked"}</span>
          </span>
        </div>
      </div>

      <p className="plan-kind-label">{kindLabel}</p>
      <h3 className="plan-title" title={title}>{title}</h3>

      <div className="plan-core">
        <IndexRing score={index} grade={grade} />
        <ul className="plan-chips" aria-label="Plan facts">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <li key={chip.hint} className="plan-chip" title={chip.hint}>
                <Icon size={13} aria-hidden="true" />
                <span className="sr-only">{chip.hint}: </span>
                {chip.label}
              </li>
            );
          })}
        </ul>
      </div>

      {meters.length > 0 && (
        <ul className="plan-meters" aria-label="Scores out of 100">
          {meters.map((meter) => {
            const Icon = meter.icon;
            const score = Math.round(Math.max(0, Math.min(100, meter.score)));
            return (
              <li key={meter.key} title={`${meter.label}: ${score}/100`}>
                <Icon size={13} aria-hidden="true" />
                <span className="sr-only">{meter.label}</span>
                <span className="plan-meter" aria-hidden="true">
                  <span style={{ width: `${score}%` }} />
                </span>
                <span className="plan-meter-value">{score}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="plan-actions">
        <button type="button" className="plan-more" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}>
          Steps <span className="plan-more-count">{steps.length}</span>
          <ChevronDown size={15} aria-hidden="true" className="plan-more-chevron" />
        </button>
        <button type="button" className="plan-select" onClick={onSelect} aria-pressed={selected} disabled={selectDisabled}>
          {selected ? <><Check size={15} aria-hidden="true" /> Selected</> : "Explore"}
        </button>
      </div>

      <div id={detailsId} className={`plan-details ${open ? "is-open" : ""}`} inert={!open}>
        <div className="plan-details-inner">
          <p className="plan-summary">{summary}</p>
          <ol className="plan-steps">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={i}>
                  <span className="plan-step-icon" aria-hidden="true"><Icon size={14} /></span>
                  <div>
                    <p className="plan-step-who">
                      {step.who}
                      {step.when ? <span className="plan-step-when">{step.when}</span> : null}
                    </p>
                    <p className="plan-step-text">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {blockers.length > 0 && <p className="plan-blockers">{blockers.join(" ")}</p>}
        </div>
      </div>
    </article>
  );
}
