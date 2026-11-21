import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardCopy, FileText, Leaf, Save, ShieldAlert } from "lucide-react";

import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { demoConflict } from "../../mocks/conflicts";
import { getWildlifeRepresentative } from "../../mocks/wildlife";
import { getConflictById } from "../../services/conflicts";
import { getMediationDraft } from "../../services/mediation";
import {
  buildAgreementPreview,
  formatAgreementText,
  getSavedAgreementDraft,
  saveAgreementDraft,
} from "../../services/agreements";
import { useHumanProfile } from "../../hooks/useHumanProfile";
import { evaluatePlan } from "../mediation/mediationLogic";
import type { SavedAgreementDraft } from "../../types/agreement";
import AgreementCard from "./AgreementCard";

export default function AgreementPage() {
  const { id } = useParams();
  const { profile } = useHumanProfile();
  const [savedAgreement, setSavedAgreement] = useState<SavedAgreementDraft | null>(
    () => (id ? getSavedAgreementDraft(id) : null)
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const conflict = id === "demo" ? demoConflict : id ? getConflictById(id) : undefined;
  const mediation = id ? getMediationDraft(id) : null;

  if (!conflict) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Conflict not found</h1>
        <p className="text-sm text-ink/60">Open a reported conflict before creating an agreement draft.</p>
        <Link to="/conflict/new" className="font-semibold text-leaf underline">Report a conflict</Link>
      </Card>
    );
  }

  if (!mediation) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-forest">Choose a compromise first</h1>
        <p className="text-sm leading-relaxed text-ink/60">
          We couldn't find a saved Step 7 plan for this conflict. Compare and select a plan in the Mediation Studio first.
        </p>
        <Link className="font-semibold text-leaf underline" to={`/conflict/${conflict.id}/mediation`}>
          Go to Mediation Studio
        </Link>
      </Card>
    );
  }

  // Re-check hard constraints against the current human profile.
  // A new accessibility requirement may make an old plan ineligible.
  const validity = evaluatePlan(mediation.selectedPlan, profile);
  const wildlife = getWildlifeRepresentative(conflict.speciesId);
  const preview = buildAgreementPreview(conflict, profile, wildlife, mediation);
  const hasMatchingSave =
    savedAgreement?.conflictId === conflict.id &&
    savedAgreement.mediationSavedAt === mediation.savedAt;
  const displayAgreement = hasMatchingSave && savedAgreement ? savedAgreement : preview;

  function handleSave() {
    setError("");
    setMessage("");
    if (!validity.eligible) return;
    try {
      setSavedAgreement(saveAgreementDraft(preview));
      setMessage("Your agreement draft was saved in this browser.");
    } catch {
      setError("Couldn't save the agreement in this browser. Please try again.");
    }
  }

  async function handleCopy() {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(formatAgreementText(displayAgreement));
      setMessage("Agreement text copied to your clipboard.");
    } catch {
      setError("Clipboard access isn't available here. Try another browser or use a secure localhost URL.");
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-bold text-forest">
          <Leaf size={15} /> STEP 04 — COEXISTENCE AGREEMENT
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-forest sm:text-5xl">
          A better way to <span className="text-leaf">share our space.</span>
        </h1>
        <p className="max-w-2xl text-ink/65">
          Here's your proposed arrangement, based on the compromise you selected in mediation. Review the terms and save a personal draft.
        </p>
      </header>

      {!validity.eligible && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert size={22} className="shrink-0" />
            <div>
              <p className="font-bold">This plan no longer meets your essential requirements.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validity.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <Link className="mt-3 inline-block font-semibold underline" to={`/conflict/${conflict.id}/mediation`}>
                Return to Mediation Studio to choose an eligible plan
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <AgreementCard agreement={displayAgreement} saved={Boolean(hasMatchingSave)} />

        <aside className="space-y-5 xl:sticky xl:top-6">
          <Card className="space-y-4">
            <div className="inline-flex rounded-2xl bg-sage/30 p-3 text-forest"><FileText size={25} /></div>
            <h2 className="text-xl font-bold text-forest">Your agreement draft</h2>
            <p className="text-sm leading-relaxed text-ink/60">
              Check the proposed conditions, save this draft locally, or copy its text to share for review.
            </p>
            <div className="space-y-3">
              <Button onClick={handleSave} disabled={!validity.eligible} className="w-full">
                <Save size={17} /> Save agreement draft
              </Button>
              <Button variant="secondary" onClick={handleCopy} className="w-full">
                <ClipboardCopy size={17} /> Copy agreement text
              </Button>
            </div>
            {hasMatchingSave && (
              <p className="flex items-start gap-2 text-sm font-medium text-leaf">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> Saved on {new Date(savedAgreement!.savedAt).toLocaleDateString()}
              </p>
            )}
            {message && <p role="status" className="text-sm text-leaf">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          </Card>

          <div className="rounded-2xl bg-peach/35 p-5">
            <p className="font-semibold text-forest">{wildlife.emoji} A word from {wildlife.name}</p>
            <p className="mt-3 text-sm italic leading-relaxed text-ink/70">
              “It's nice when we can make room for everyone. But please ask a human wildlife expert before making changes around my home!”
            </p>
            <p className="mt-3 text-xs text-ink/50">Fictional character dialogue, not animal consent.</p>
          </div>

          <Link to={`/conflict/${conflict.id}/mediation`} className="inline-flex items-center gap-2 text-sm font-semibold text-leaf underline">
            <ArrowLeft size={16} /> Adjust plan in Mediation Studio
          </Link>
        </aside>
      </div>
    </div>
  );
}
