import {
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  Leaf,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Card from "../../components/ui/Card";
import type { AgreementPreview, AgreementTermGroup } from "../../types/agreement";

const groups = [
  { key: "wildlife", label: "01 / Wildlife protection", icon: Leaf },
  { key: "human", label: "02 / Human access & safety", icon: UserRound },
  { key: "shared", label: "03 / Proposed shared actions", icon: HeartHandshake },
  { key: "review", label: "04 / Review & oversight", icon: RefreshCw },
] as const satisfies ReadonlyArray<{
  key: AgreementTermGroup;
  label: string;
  icon: typeof Leaf;
}>;

interface AgreementCardProps {
  agreement: AgreementPreview;
  saved: boolean;
}

export default function AgreementCard({ agreement, saved }: AgreementCardProps) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="bg-forest px-6 py-8 text-cream sm:px-9 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sage">
              Neighborhood agreement · 2126
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A little room for everyone.
            </h2>
          </div>
          <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold">
            {saved ? "Saved draft" : "Preview draft"}
          </span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream/75">
          A proposed arrangement for sharing space respectfully. This is a demo
          document, not a signed contract, permit, or wildlife authorization.
        </p>
      </div>

      <div className="space-y-8 p-6 sm:p-9">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-sage/20 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-leaf">
              Human representative
            </p>
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{agreement.humanAvatar}</span>
              <p className="min-w-0 break-words text-lg font-bold text-forest">
                {agreement.humanName}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-peach/35 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-leaf">
              Fictional wildlife representative
            </p>
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{agreement.wildlifeEmoji}</span>
              <p className="min-w-0 break-words text-lg font-bold text-forest">
                {agreement.wildlifeName}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-leaf">Reported situation</p>
          <h3 className="mt-2 text-xl font-bold text-forest">{agreement.conflictTitle}</h3>
          <p className="mt-2 text-sm text-ink/60">{agreement.conflictLocation}</p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-forest/10 bg-cream p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-leaf">
              Selected compromise
            </p>
            <h3 className="mt-2 text-xl font-bold text-forest">{agreement.planTitle}</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/60">
              {agreement.planSummary}
            </p>
          </div>
          <div className="rounded-2xl bg-sage/40 px-5 py-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-forest">
              {agreement.coexistenceIndex}<span className="text-base text-ink/50">/100</span>
            </p>
            <p className="mt-1 text-xs font-medium text-forest">Coexistence Index</p>
            <p className="text-[10px] text-ink/50">Illustrative</p>
          </div>
        </div>

        <div className="space-y-7">
          {groups.map(({ key, label, icon: Icon }) => {
            const terms = agreement.terms.filter((term) => term.group === key);
            return (
              <section key={key}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-xl bg-sage/25 p-2.5 text-forest"><Icon size={20} /></span>
                  <h3 className="text-lg font-bold text-forest">{label}</h3>
                </div>
                <div className="space-y-3">
                  {terms.map((term) => (
                    <div key={term.id} className="rounded-2xl border border-forest/10 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-leaf" />
                        <div>
                          <h4 className="font-semibold text-forest">{term.title}</h4>
                          <p className="mt-1 text-sm leading-relaxed text-ink/65">
                            {term.description}
                          </p>
                          <p className="mt-2 text-xs text-ink/45">
                            Proposed responsibility: {term.responsibleParty}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="rounded-2xl bg-sage/20 p-5">
          <div className="mb-3 flex items-center gap-2 text-forest">
            <ClipboardList size={20} />
            <h3 className="font-bold">When should we review this?</h3>
          </div>
          <ul className="space-y-2 text-sm leading-relaxed text-ink/70">
            {agreement.reviewTriggers.map((trigger) => (
              <li className="flex items-start gap-2" key={trigger}>
                <span aria-hidden="true" className="text-leaf">•</span>
                {trigger}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink/55">
            No automatic end date is assumed; the situation requires verification.
          </p>
        </div>

        <div className="flex items-start gap-3 border-t border-forest/10 pt-6 text-xs leading-relaxed text-ink/60">
          <ShieldCheck size={20} className="shrink-0 text-leaf" />
          <p>
            A wildlife representative is a storytelling character, not a consenting
            party. All scores, interventions, and route illustrations are prototype
            assumptions. Implementation requires appropriate review and permissions.
          </p>
        </div>
      </div>
    </Card>
  );
}
