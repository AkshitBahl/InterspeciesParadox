import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Leaf, MapPinned, ShieldCheck } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingState from "../../components/ui/LoadingState";
import ConflictForm from "../conflict/ConflictForm";
import ConflictCard from "../conflict/ConflictCard";

import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import { conflictToReport, draftToCreateBody, statusLabels } from "../../services/live/adapters";
import { errorMessage } from "../../services/live/client";
import { saveConflictExtras } from "../../services/live/extras";
import type { LiveConflict, MapLocation, SpeciesSummary } from "../../services/live/types";
import type { ConflictDraft } from "../../types";

// Where people are affected. The animal's own home is attached from the species.
const layerGroups: Record<string, string> = {
  building: "Buildings",
  entrance: "Entrances",
  point_of_interest: "Shared places",
  habitat_zone: "Green spaces",
};
const groupOrder = Object.keys(layerGroups);

export default function LiveReportConflictPage() {
  const navigate = useNavigate();
  const options = useLiveData("report-options", async () => {
    const [species, locations, sites] = await Promise.all([liveApi.listSpecies(), liveApi.locations(), liveApi.wildlifeSites()]);
    const homes: Record<string, string> = {};
    for (const site of sites.features) {
      const slug = site.properties.species_slug;
      if (typeof slug === "string" && typeof site.properties.id === "string") homes[slug] ??= site.properties.id;
    }
    return { species, locations, homes };
  });
  const [submitted, setSubmitted] = useState<LiveConflict | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(draft: ConflictDraft, locations: MapLocation[], homes: Record<string, string>) {
    setIsSubmitting(true);
    setError("");
    try {
      const place = locations.find((item) => item.feature_id === draft.location);
      const conflict = await liveApi.createConflict(draftToCreateBody(draft, place, homes[draft.speciesId]));
      saveConflictExtras(conflict.id, {
        conflictType: draft.conflictType,
        observedActivity: draft.observedActivity,
        affectedNeeds: draft.affectedNeeds,
        accessBlocked: draft.accessBlocked,
      });
      setSubmitted(conflict);
    } catch (err) {
      setError(errorMessage(err, "Could not save your report. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-sage/40">
            <CheckCircle2 size={40} className="text-forest" />
          </div>
          <h1 className="text-4xl font-bold text-forest">Your story has been heard.</h1>
          <p className="mt-3 text-ink/60">
            Your report is saved in the mediation backend. {submitted.species.representative_name} is ready to talk.
          </p>
        </div>

        <ConflictCard
          conflict={conflictToReport(submitted)}
          species={{ name: submitted.species.common_name, emoji: submitted.species.emoji }}
          statusLabel={statusLabels[submitted.status]}
        />

        <div className="flex flex-wrap justify-center gap-4">
          <Button onClick={() => navigate(`/conflict/${submitted.id}/assessment`)}>
            Continue to needs assessment <ArrowRight size={18} />
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSubmitted(null);
              setFormKey((k) => k + 1);
            }}
          >
            Report another conflict
          </Button>
        </div>
      </div>
    );
  }

  const speciesOptions = (options.data?.species ?? []).map((species: SpeciesSummary) => ({
    id: species.slug,
    name: `${species.common_name} (${species.representative_name})`,
    emoji: species.emoji,
  }));
  const locationOptions = (options.data?.locations ?? [])
    .filter((place) => place.layer in layerGroups)
    .sort((a, b) => groupOrder.indexOf(a.layer) - groupOrder.indexOf(b.layer) || a.name.localeCompare(b.name))
    .map((place) => ({ value: place.feature_id, label: place.name, group: layerGroups[place.layer] }));

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
          <Leaf size={15} /> START YOUR COEXISTENCE JOURNEY
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          Let's talk about<span className="text-leaf"> the problem.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink/60">
          Tell us what's happening between you and your wild neighbor. Every good compromise starts with
          understanding the situation.
        </p>
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {options.loading ? (
            <LoadingState label="Loading species and places…" />
          ) : options.error ? (
            <Card className="space-y-3">
              <p role="alert" className="text-sm text-red-700">{options.error}</p>
              <Button variant="secondary" onClick={options.reload}>Try again</Button>
            </Card>
          ) : (
            <ConflictForm
              key={formKey}
              onSubmit={(draft) => handleSubmit(draft, options.data?.locations ?? [], options.data?.homes ?? {})}
              isSubmitting={isSubmitting}
              speciesOptions={speciesOptions}
              locationOptions={locationOptions}
              saveNote="Your report is saved in the mediation backend, under your account."
            />
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <Card className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage/40">
              <ShieldCheck size={25} className="text-forest" />
            </div>
            <h3 className="text-xl font-semibold text-forest">We're here to find common ground.</h3>
            <p className="text-sm leading-relaxed text-ink/60">
              The mediator compares your needs with the species' real ecological data, then proposes compromises
              and scores each one with the Coexistence Index.
            </p>
            <div className="border-t border-forest/10 pt-4">
              <p className="mb-3 text-sm font-semibold text-forest">What happens next?</p>
              <div className="space-y-3 text-sm text-ink/70">
                <p>01 · Compare human and wildlife needs</p>
                <p>02 · Explore compromise plans on the map</p>
                <p>03 · Negotiate with the species representative</p>
                <p>04 · Sign a temporary coexistence agreement</p>
              </div>
            </div>
          </Card>

          <div className="rounded-2xl bg-peach/40 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest">
              <MapPinned size={16} /> Tip
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              For the location, pick where people are affected (a playground, an entrance, a balcony). The
              animal's home is already on the map, so the mediator measures the distance between the two.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
