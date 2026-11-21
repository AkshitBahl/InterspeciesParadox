
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  HeartHandshake,
  Leaf,
  Scale,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

import NeedsComparison from "./NeedsComparison";
import WildlifeDialogue from "../wildlife/WildlifeDialogue";

import { demoConflict } from "../../mocks/conflicts";
import { getConflictById } from "../../services/conflicts";
import { buildNeedsAssessment } from "../../services/assessments";
import { getWildlifeRepresentative } from "../../mocks/wildlife";
import { useHumanProfile } from "../../hooks/useHumanProfile";

export default function AssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { profile } = useHumanProfile();

  // Use the demo conflict or a previously submitted report.
  const conflict =
    id === "demo"
      ? demoConflict
      : id
        ? getConflictById(id)
        : undefined;

  if (!conflict) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">
          Conflict not found
        </h1>

        <p className="text-ink/60">
          We couldn't find this conflict report.
          It may have been deleted from browser storage.
        </p>

        <Link
          to="/conflict/new"
          className="inline-block font-semibold text-leaf underline"
        >
          Report a new conflict
        </Link>
      </Card>
    );
  }

  const wildlife = getWildlifeRepresentative(
    conflict.speciesId
  );

  const assessment = buildNeedsAssessment(
    conflict,
    profile
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <section>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
          <Scale size={15} />
          STEP 02 — NEEDS ASSESSMENT
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          Every neighbor
          <span className="text-leaf"> deserves a voice.</span>
        </h1>

        <p className="mt-4 max-w-2xl leading-relaxed text-ink/60">
          Before finding a compromise, let's understand
          what matters to you and your wild neighbor.
        </p>
      </section>

      {/* Conflict summary */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-leaf">
          Your reported conflict
        </p>

        <h2 className="text-xl font-bold text-forest">
          {conflict.title}
        </h2>

        <p className="text-sm leading-relaxed text-ink/70">
          {conflict.description}
        </p>

        <p className="text-xs text-ink/50">
          Location: {conflict.location}
        </p>
      </Card>

      {/* Needs comparison */}
      <NeedsComparison
        human={profile}
        wildlife={wildlife}
        assessment={assessment}
      />

      {/* Human profile priorities */}
      <Card className="space-y-4">
        <h2 className="text-xl font-bold text-forest">
          Your personal priorities
        </h2>

        <p className="text-sm text-ink/60">
          These preferences will help the mediator
          compare otherwise safe plans.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-sage/20 p-4">
            <p className="text-sm text-ink/60">
              Minimize detours
            </p>
            <p className="mt-2 text-2xl font-bold text-forest">
              {profile.priorities.minimizeDetours}/5
            </p>
          </div>

          <div className="rounded-xl bg-peach/30 p-4">
            <p className="text-sm text-ink/60">
              Quiet environment
            </p>
            <p className="mt-2 text-2xl font-bold text-forest">
              {profile.priorities.quietEnvironment}/5
            </p>
          </div>
        </div>

        <Link
          to="/profile"
          className="inline-block text-sm font-semibold text-leaf underline"
        >
          Edit my profile
        </Link>
      </Card>

      {/* Wildlife character */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-forest">
          A message from your wild neighbor
        </h2>

        <WildlifeDialogue
          representative={wildlife}
          activity={conflict.observedActivity}
        />
      </section>

      {/* Needs and conflicts */}
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-forest">
            Where do your needs meet?
          </h2>

          <p className="mt-2 text-sm text-ink/60">
            Our preliminary assessment identifies
            potential conflicts and shared goals.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {assessment.tensions.map((tension) => {
            const isShared = tension.type === "shared";

            return (
              <Card key={tension.id} className="space-y-4">
                <div
                  className={`inline-flex rounded-xl p-3 ${
                    isShared
                      ? "bg-sage/40 text-forest"
                      : "bg-peach/50 text-forest"
                  }`}
                >
                  {isShared ? (
                    <HeartHandshake size={24} />
                  ) : (
                    <Scale size={24} />
                  )}
                </div>

                <span className="block text-xs font-semibold uppercase tracking-widest text-leaf">
                  {isShared
                    ? "Shared goal"
                    : "Potential conflict"}
                </span>

                <h3 className="text-lg font-semibold text-forest">
                  {tension.title}
                </h3>

                <p className="text-sm leading-relaxed text-ink/60">
                  {tension.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Verification warning */}
      {assessment.needsSpeciesVerification && (
        <div
          role="status"
          className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900"
        >
          <AlertTriangle className="shrink-0" size={22} />

          <p className="text-sm">
            The species hasn't been identified.
            Its biological requirements must be
            verified before recommending interventions.
          </p>
        </div>
      )}

      {/* Next step */}
      <section className="rounded-3xl bg-sage/25 p-7 sm:p-9">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-forest">
          <ShieldCheck size={27} />
        </div>

        <h2 className="text-2xl font-bold text-forest">
          Ready to find common ground?
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
          The next step is mediation. We'll use these
          needs to explore possible arrangements,
          check non-negotiable constraints, and
          compare the trade-offs.
        </p>

        <p className="mt-3 max-w-2xl text-xs text-ink/50">
          This is a simulated assessment for the
          hackathon. Real ecological interventions
          require verified guidance and any necessary
          professional authorization.
        </p>

        <div className="mt-6">
          <Button
            onClick={() =>
              navigate(
                `/conflict/${conflict.id}/mediation`
              )
            }
          >
            Continue to mediation
            <ArrowRight size={18} />
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 text-sm text-ink/40">
        <Leaf size={16} />
        A city where everyone belongs.
      </div>
    </div>
  );
}
