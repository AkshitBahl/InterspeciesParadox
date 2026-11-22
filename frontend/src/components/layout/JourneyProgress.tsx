import { Check } from "lucide-react";
import { useLocation } from "react-router-dom";

type Stage = "report" | "assessment" | "mediation" | "agreement";

const steps: { id: Stage; title: string; subtitle: string }[] = [
  { id: "report", title: "Report", subtitle: "Tell your story" },
  { id: "assessment", title: "Assessment", subtitle: "Understand needs" },
  { id: "mediation", title: "Mediation", subtitle: "Explore solutions" },
  { id: "agreement", title: "Agreement", subtitle: "Review a draft" },
];

function activeStage(pathname: string): Stage | null {
  if (/^\/conflict\/new\/?$/.test(pathname)) return "report";
  const match = pathname.match(
    /^\/conflict\/[^/]+\/(assessment|mediation|agreement)\/?$/
  );
  return (match?.[1] as Stage | undefined) ?? null;
}

export default function JourneyProgress() {
  const { pathname } = useLocation();
  const stage = activeStage(pathname);
  if (!stage) return null;

  const currentIndex = steps.findIndex((step) => step.id === stage);

  return (
    <nav aria-label="Your coexistence journey" className="journey-progress mb-8 rounded-3xl border border-forest/10 bg-white/85 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-leaf">Your journey</p>
        <p className="text-xs font-medium text-ink/55" aria-live="polite">Step {currentIndex + 1} of {steps.length}</p>
      </div>
      <ol className="grid grid-cols-4 gap-1 sm:gap-3">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step.id} aria-current={isCurrent ? "step" : undefined} className="min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-10 sm:w-10",
                    isComplete ? "journey-dot-done" : isCurrent ? "journey-dot-now" : "journey-dot-next",
                  ].join(" ")}
                >
                  {isComplete ? <Check size={17} aria-hidden="true" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-[11px] font-semibold sm:text-sm ${isCurrent ? "text-forest" : "text-ink/60"}`}>
                    {step.title}
                  </p>
                  <p className="hidden text-xs text-ink/45 lg:block">{step.subtitle}</p>
                </div>
              </div>
              <div className={`journey-bar mt-3 h-1 rounded-full ${isComplete || isCurrent ? "is-lit" : ""}`} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
