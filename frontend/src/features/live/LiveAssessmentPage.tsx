import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Gavel, HeartHandshake, Leaf, RefreshCw, Scale, ShieldCheck } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import LoadingState from "../../components/ui/LoadingState";
import NeedsCard from "../assessment/NeedsCard";
import LiveRepresentative from "./LiveRepresentative";
import { useLiveConflict } from "./useLiveConflict";
import { useSession } from "./session";

import { useHumanProfile } from "../../hooks/useHumanProfile";
import { useLiveData } from "../../hooks/useLiveData";
import { ApiRequestError } from "../../services/apiClient";
import { liveApi } from "../../services/live/api";
import { assessmentTensions, needToAssessed, speciesToRepresentative, statusLabels } from "../../services/live/adapters";
import { errorMessage } from "../../services/live/client";
import { getConflictExtras } from "../../services/live/extras";

export default function LiveAssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const { profile } = useHumanProfile();
  const conflict = useLiveConflict(id, "assessment");
  const conflictId = conflict.data?.id;
  const slug = conflict.data?.species.slug;

  const assessment = useLiveData(conflictId ? `assessment:${conflictId}` : null, async () => {
    try {
      return await liveApi.getAssessment(conflictId!);
    } catch (error) {
      // No assessment yet: run the first one now.
      if (error instanceof ApiRequestError && error.status === 404) return liveApi.runAssessment(conflictId!);
      throw error;
    }
  });
  const species = useLiveData(slug ? `species:${slug}` : null, () => liveApi.getSpecies(slug!));
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState("");

  if (conflict.loading) return <LoadingState label="Opening your case…" />;
  if (conflict.error || !conflict.data) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Conflict not found</h1>
        <p className="text-ink/60">{conflict.error || "We couldn't find this conflict report."}</p>
        <Link to="/conflict/new" className="inline-block font-semibold text-leaf underline">Report a new conflict</Link>
      </Card>
    );
  }

  const report = conflict.data;
  const extras = getConflictExtras(report.id);
  const representative = species.data
    ? speciesToRepresentative(species.data)
    : speciesToRepresentative(report.species);

  async function rerun() {
    setRerunning(true);
    setRerunError("");
    try {
      assessment.setData(await liveApi.runAssessment(report.id));
      conflict.reload();
    } catch (error) {
      setRerunError(errorMessage(error));
    } finally {
      setRerunning(false);
    }
  }

  const data = assessment.data;
  const tensions = data ? assessmentTensions(data) : [];

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
          <Scale size={15} /> STEP 02 · NEEDS ASSESSMENT
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          Every neighbor<span className="text-leaf"> deserves a voice.</span>
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/60">
          The mediator compares what you need with what your wild neighbor, the {report.species.common_name.toLowerCase()},
          needs, using structured ecological data.
        </p>
      </section>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-leaf">
            {report.reporter_id === session?.user.id ? "Your reported conflict" : `Reported by ${report.reporter_name ?? "a neighbor"}`}
          </p>
          <span className="rounded-full bg-sage/40 px-3 py-1.5 text-xs font-semibold text-forest">{statusLabels[report.status]}</span>
        </div>
        <h2 className="text-xl font-bold text-forest">{report.species.emoji} {report.title}</h2>
        <p className="text-sm leading-relaxed text-ink/70">{report.description}</p>
        <p className="text-xs text-ink/50">Location: {report.human_activity?.description ?? "on the map"}</p>
      </Card>

      {assessment.loading ? (
        <LoadingState label="Assessing human and wildlife needs…" />
      ) : assessment.error || !data ? (
        <Card className="space-y-3">
          <p role="alert" className="text-sm text-red-700">{assessment.error}</p>
          <Button variant="secondary" onClick={assessment.reload}>Try again</Button>
        </Card>
      ) : (
        <>
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-forest">Meet your neighbors</h2>
                <p className="mt-2 text-sm text-ink/60">Two different perspectives. One shared space.</p>
              </div>
              <Button variant="secondary" onClick={rerun} disabled={rerunning}>
                <RefreshCw size={16} className={rerunning ? "animate-spin" : ""} /> Re-run assessment
              </Button>
            </div>
            {rerunError && <p role="alert" className="text-sm text-red-700">{rerunError}</p>}
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <NeedsCard
                emoji={profile.avatar}
                name={report.reporter_name ?? session?.user.display_name ?? "Resident"}
                role="Human representative"
                needs={data.human_needs.map(needToAssessed)}
              />
              <NeedsCard
                emoji={representative.emoji}
                name={representative.name}
                role={`Wildlife representative · ${report.species.common_name}`}
                needs={data.wildlife_needs.map(needToAssessed)}
              />
            </div>
          </section>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-forest">The mediator's summary</h2>
              <span className="rounded-full bg-peach/50 px-3 py-1.5 text-xs font-semibold text-forest">
                Conflict intensity {Math.round(data.conflict_intensity * 100)}%
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink/70">{data.summary}</p>
            {data.constraints.length > 0 && (
              <div className="border-t border-forest/10 pt-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest">
                  <Gavel size={16} /> Rules every plan must respect
                </p>
                <ul className="space-y-2 text-sm text-ink/70">
                  {data.constraints.map((rule) => (
                    <li key={rule.text} className="flex gap-2">
                      <span className="text-leaf">•</span>
                      <span>{rule.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.co_benefits.length > 0 && (
              <p className="rounded-xl bg-sage/20 p-4 text-sm text-forest">
                🌱 Good to know: {data.co_benefits.map((b) => b.benefit).join(" · ")}
              </p>
            )}
          </Card>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-forest">A message from your wild neighbor</h2>
            {slug && (
              <LiveRepresentative
                slug={slug}
                representative={representative}
                activity={extras?.observedActivity ?? "unknown"}
                topics={[
                  { id: "needs", label: "My needs", heading: "What matters to me", statement: data.representative_statement, mood: "thoughtful" },
                ]}
                initialTopic="needs"
              />
            )}
          </section>

          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-forest">Where do your needs meet?</h2>
              <p className="mt-2 text-sm text-ink/60">Clashing needs become the mediator's to-do list. Shared goals make compromise easier.</p>
            </div>
            {tensions.length === 0 ? (
              <p className="text-sm text-ink/60">No direct clashes found. A light-touch plan may be enough.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tensions.map((tension) => {
                  const isShared = tension.type === "shared";
                  return (
                    <Card key={tension.id} className="space-y-4">
                      <div className={`inline-flex rounded-xl p-3 ${isShared ? "bg-sage/40" : "bg-peach/50"} text-forest`}>
                        {isShared ? <HeartHandshake size={24} /> : <Scale size={24} />}
                      </div>
                      <span className="block text-xs font-semibold uppercase tracking-widest text-leaf">
                        {isShared ? "Shared goal" : "Potential conflict"}
                      </span>
                      <h3 className="text-lg font-semibold text-forest">{tension.title}</h3>
                      <p className="text-sm leading-relaxed text-ink/60">{tension.description}</p>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {report.species.is_legally_protected && (
            <div role="status" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
              <AlertTriangle className="shrink-0" size={22} />
              <p className="text-sm">
                The {report.species.common_name.toLowerCase()} is legally protected. Plans that break the rules are
                capped low on the Coexistence Index and can't be the recommended choice.
              </p>
            </div>
          )}

          <section className="rounded-3xl bg-sage/25 p-7 sm:p-9">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-forest">
              <ShieldCheck size={27} />
            </div>
            <h2 className="text-2xl font-bold text-forest">Ready to find common ground?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
              Next, the mediator proposes compromise plans, draws them on the map and scores each one.
            </p>
            <p className="mt-3 max-w-2xl text-xs text-ink/50">
              Change your accessibility needs in <Link to="/profile" className="underline">your profile</Link>, then re-run the assessment to see them here.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate(`/conflict/${report.id}/mediation`)}>
                Continue to mediation <ArrowRight size={18} />
              </Button>
            </div>
          </section>
        </>
      )}

      <div className="flex items-center justify-center gap-2 text-sm text-ink/40">
        <Leaf size={16} /> A city where everyone belongs.
      </div>
    </div>
  );
}
