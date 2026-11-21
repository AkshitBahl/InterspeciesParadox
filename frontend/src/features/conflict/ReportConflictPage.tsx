
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

import ConflictForm from "./ConflictForm";
import ConflictCard from "./ConflictCard";

import { createConflict } from "../../services/conflicts";

import type {
  ConflictDraft,
  ConflictReport,
} from "../../types";

export default function ReportConflictPage() {
  const navigate = useNavigate();

  const [submitted, setSubmitted] =
    useState<ConflictReport | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  async function handleSubmit(draft: ConflictDraft) {
    setIsSubmitting(true);
    setError("");

    try {
      const report = await createConflict(draft);
      setSubmitted(report);
    } catch {
      setError("Could not save your report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-sage/40">
            <CheckCircle2
              size={40}
              className="text-forest"
            />
          </div>

          <h1 className="text-4xl font-bold text-forest">
            Your story has been heard.
          </h1>

          <p className="mt-3 text-ink/60">
            Your conflict report has been saved.
            Now it's time to understand both sides.
          </p>
        </div>

        <ConflictCard conflict={submitted} />

        <div className="flex flex-wrap justify-center gap-4">
          <Button
            onClick={() =>
              navigate(
                `/conflict/${submitted.id}/assessment`
              )
            }
          >
            Continue to needs assessment
            <ArrowRight size={18} />
          </Button>

          <Button
            variant="secondary"
            onClick={() => setSubmitted(null)}
          >
            Report another conflict
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <section>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
          <Leaf size={15} />
          START YOUR COEXISTENCE JOURNEY
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          Let's talk about
          <span className="text-leaf"> the problem.</span>
        </h1>

        <p className="mt-4 max-w-2xl text-ink/60">
          Tell us what's happening between you and
          your wild neighbor. Every good compromise
          starts with understanding the situation.
        </p>
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Main form */}
        <div>
          <ConflictForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-600"
            >
              {error}
            </p>
          )}
        </div>

        {/* Information sidebar */}
        <aside className="space-y-5 xl:sticky xl:top-6">
          <Card className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage/40">
              <ShieldCheck
                size={25}
                className="text-forest"
              />
            </div>

            <h3 className="text-xl font-semibold text-forest">
              We're here to find common ground.
            </h3>

            <p className="text-sm leading-relaxed text-ink/60">
              Your report helps our mediator understand
              the situation before proposing possible
              coexistence solutions.
            </p>

            <div className="border-t border-forest/10 pt-4">
              <p className="mb-3 text-sm font-semibold text-forest">
                What happens next?
              </p>

              <div className="space-y-3 text-sm text-ink/70">
                <p>01 — Compare human and wildlife needs</p>
                <p>02 — Explore compromise plans</p>
                <p>03 — Negotiate the best arrangement</p>
                <p>04 — Create your coexistence agreement</p>
              </div>
            </div>
          </Card>

          <div className="rounded-2xl bg-peach/40 p-5">
            <p className="text-sm font-semibold text-forest">
              🐦 A note from your wild neighbors
            </p>

            <p className="mt-2 text-sm italic leading-relaxed text-ink/70">
              "We're not trying to be difficult.
              We just have different ideas about
              personal space."
            </p>

            <p className="mt-3 text-xs text-ink/50">
              Playful fictional wildlife dialogue
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
