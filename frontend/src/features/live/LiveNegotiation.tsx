import { useState, type FormEvent } from "react";
import { Handshake, MessagesSquare, Send, SlidersHorizontal } from "lucide-react";

import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import { errorMessage } from "../../services/live/client";
import type { CounterProposalResult, Negotiation, ParameterSpec, Solution, Verdict } from "../../services/live/types";

const verdictText: Record<Verdict, { label: string; style: string }> = {
  accept: { label: "Accepted", style: "border-leaf bg-sage/30 text-forest" },
  accept_with_concerns: { label: "Accepted, with concerns", style: "border-amber-300 bg-amber-50 text-amber-900" },
  counter: { label: "Counter-offer", style: "border-peach bg-peach/30 text-forest" },
  reject: { label: "Rejected", style: "border-red-300 bg-red-50 text-red-800" },
};

const inputStyle =
  "w-full rounded-xl border border-forest/15 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/10";

function Knob({ spec, value, onChange }: { spec: ParameterSpec; value: unknown; onChange: (v: unknown) => void }) {
  const id = `param-${spec.name}`;
  const label = (
    <span className="block text-sm font-semibold text-forest">
      {spec.label}
      {spec.unit ? <span className="font-normal text-ink/50"> ({spec.unit})</span> : null}
    </span>
  );
  const note =
    spec.ecological_minimum !== null ? (
      <span className="mt-1 block text-xs text-ink/50">Ecological minimum: {spec.ecological_minimum}{spec.unit ? ` ${spec.unit}` : ""}</span>
    ) : spec.description ? (
      <span className="mt-1 block text-xs text-ink/50">{spec.description}</span>
    ) : null;

  if (spec.type === "boolean") {
    return (
      <label htmlFor={id} className="flex cursor-pointer gap-3 rounded-2xl border border-forest/10 bg-cream p-4">
        <input id={id} type="checkbox" className="mt-1 h-4 w-4 accent-leaf" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}{note}</span>
      </label>
    );
  }

  let control;
  if (spec.type === "number" || spec.type === "integer") {
    const num = typeof value === "number" ? value : Number(value ?? spec.minimum ?? 0);
    const below = spec.ecological_minimum !== null && num < spec.ecological_minimum;
    control = (
      <div className="flex items-center gap-3">
        {spec.minimum !== null && spec.maximum !== null && (
          <input
            type="range"
            aria-label={spec.label}
            className="flex-1 accent-leaf"
            min={spec.minimum}
            max={spec.maximum}
            step={spec.type === "integer" ? 1 : (spec.maximum - spec.minimum) / 100 >= 1 ? 1 : 0.5}
            value={num}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}
        <input
          id={id}
          type="number"
          className={`${inputStyle} w-24 ${below ? "border-amber-400" : ""}`}
          min={spec.minimum ?? undefined}
          max={spec.maximum ?? undefined}
          step={spec.type === "integer" ? 1 : "any"}
          value={num}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  } else if (spec.type === "choice" && spec.choices) {
    control = (
      <select id={id} className={inputStyle} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        {spec.choices.map((choice) => <option key={choice} value={choice}>{choice.replace(/_/g, " ")}</option>)}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        type={spec.type === "date" ? "date" : "text"}
        className={inputStyle}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-forest/10 bg-cream p-4">
      <label htmlFor={id}>{label}</label>
      <div className="mt-3">{control}</div>
      {note}
    </div>
  );
}

interface Props {
  conflictId: string;
  solution: Solution;
  negotiation: Negotiation | null;
  canAccept: boolean;
  /** The representative's last answer. Kept by the page so it survives switching to the new revision. */
  lastVerdict: CounterProposalResult | null;
  onNegotiation: (negotiation: Negotiation) => void;
  onCounter: (result: CounterProposalResult) => void;
  onAccept: () => Promise<void>;
}

/** Step 7: change a plan's knobs and hear the representative's verdict, then accept. */
export default function LiveNegotiation({ conflictId, solution, negotiation, canAccept, lastVerdict, onNegotiation, onCounter, onAccept }: Props) {
  const params = useLiveData(`params:${solution.id}`, () => liveApi.parameters(solution.id));
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [note, setNote] = useState("");
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState<"" | "open" | "counter" | "chat" | "accept">("");
  const [error, setError] = useState("");

  async function run(kind: typeof busy, action: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  const changed = Object.fromEntries(
    Object.entries(changes).filter(([name, value]) => params.data?.find((p) => p.name === name)?.current_value !== value)
  );

  if (!negotiation) {
    return (
      <section className="rounded-3xl border border-forest/10 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-forest"><Handshake size={21} /> Negotiate your compromise</h2>
        <p className="mt-2 text-sm text-ink/60">
          Put <strong>{solution.title}</strong> on the table. You can then tweak it and the species representative will answer.
        </p>
        <Button className="mt-5" disabled={busy !== ""} onClick={() => run("open", async () => onNegotiation(await liveApi.openNegotiation(conflictId, solution.id)))}>
          {busy === "open" ? "Opening…" : "Start negotiating on this plan"}
        </Button>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </section>
    );
  }

  const closed = negotiation.status !== "open";
  const messages = negotiation.messages.slice(-8);

  return (
    <section className="space-y-6 rounded-3xl border border-forest/10 bg-white p-6 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-forest"><Handshake size={21} /> Negotiate your compromise</h2>
        <p className="mt-2 text-sm text-ink/60">
          Selected: <strong>{solution.title}</strong> · round {negotiation.rounds} · {negotiation.status}
        </p>
      </div>

      {!closed && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-forest"><SlidersHorizontal size={16} /> Change the plan</p>
          {params.loading && !params.data ? (
            <LoadingState compact label="Loading what can change…" />
          ) : params.error ? (
            <p role="alert" className="text-sm text-red-700">{params.error}</p>
          ) : params.data && params.data.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {params.data.map((spec) => (
                  <Knob
                    key={spec.name}
                    spec={spec}
                    value={spec.name in changes ? changes[spec.name] : spec.current_value}
                    onChange={(value) => setChanges((prev) => ({ ...prev, [spec.name]: value }))}
                  />
                ))}
              </div>
              <input
                className={inputStyle}
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the representative (optional)"
              />
              <Button
                disabled={busy !== "" || Object.keys(changed).length === 0}
                onClick={() =>
                  run("counter", async () => {
                    const result = await liveApi.counterProposal(conflictId, solution.id, changed, note);
                    setChanges({});
                    setNote("");
                    onCounter(result);
                  })
                }
              >
                {busy === "counter" ? "Waiting for the answer…" : `Send counter-proposal${Object.keys(changed).length ? ` (${Object.keys(changed).length} change${Object.keys(changed).length > 1 ? "s" : ""})` : ""}`}
              </Button>
            </>
          ) : (
            <p className="text-sm text-ink/60">This plan has nothing to tweak. Chat or accept it below.</p>
          )}
        </div>
      )}

      {lastVerdict && (
        <div className={`rounded-2xl border p-4 text-sm ${verdictText[lastVerdict.verdict].style}`} role="status">
          <p className="font-bold">
            Verdict: {verdictText[lastVerdict.verdict].label} · new index {Math.round(lastVerdict.revision.coexistence_index)}/100
          </p>
          {lastVerdict.messages
            .filter((m) => m.author_type === "representative")
            .map((m) => <p key={m.id} className="mt-2 italic">“{m.text}”</p>)}
          {lastVerdict.counter_solution && (
            <p className="mt-2">The representative made a counter-offer: <strong>{lastVerdict.counter_solution.title}</strong> (index {Math.round(lastVerdict.counter_solution.coexistence_index)}). It's now in the plan list.</p>
          )}
        </div>
      )}

      <div className="space-y-3 border-t border-forest/10 pt-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-forest"><MessagesSquare size={16} /> Conversation</p>
        <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-2xl p-3 text-sm ${
                m.author_type === "representative" ? "bg-forest text-cream" : m.author_type === "system" ? "bg-cream text-ink/60" : "bg-sage/30 text-forest"
              }`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider opacity-70">{m.author_name}</span>
              {m.text}
            </li>
          ))}
        </ol>
        {!closed && (
          <form
            className="flex gap-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (!chat.trim()) return;
              run("chat", async () => {
                await liveApi.sendMessage(conflictId, chat.trim());
                setChat("");
                onNegotiation(await liveApi.getNegotiation(conflictId));
              });
            }}
          >
            <input className={inputStyle} value={chat} maxLength={2000} onChange={(e) => setChat(e.target.value)} placeholder="Say something to the representative" aria-label="Message" />
            <Button type="submit" disabled={busy !== "" || !chat.trim()} className="!px-4"><Send size={16} /></Button>
          </form>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!closed && (
        <div className="rounded-2xl bg-sage/25 p-5">
          <p className="text-sm font-semibold text-forest">Happy with “{solution.title}”?</p>
          <p className="mt-1 text-xs text-ink/60">Accepting writes a temporary coexistence agreement for you to sign.</p>
          <Button className="mt-4" disabled={!canAccept || busy !== ""} onClick={() => run("accept", onAccept)}>
            {busy === "accept" ? "Writing the agreement…" : "Accept this plan"}
          </Button>
          {!canAccept && <p className="mt-2 text-xs text-ink/60">Only the person who reported this case can accept a plan. Log in as them to finish it.</p>}
        </div>
      )}
    </section>
  );
}
