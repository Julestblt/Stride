"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ProposalWeek = {
  weekStart: string;
  minutes: number;
  sessions: { date: string; title: string; minutes: number }[];
};

type Proposal = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  weeks: ProposalWeek[] | null;
};

type Mode = "conversation" | "plan";

const budgets: Record<Mode, string> = { conversation: "1 $", plan: "2 $" };

function frDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

type TranscriptItem =
  | { type: "coach"; text: string }
  | { type: "delegation"; from: string; to: string; text: string }
  | { type: "tool"; thread: string; name: string; ok: boolean; ms: number }
  | { type: "mcp"; thread: string; name: string }
  | { type: "error"; code: string; text: string };

type PendingQuestion = {
  toolUseId: string;
  question: string;
  askedFor: string;
};

type TurnDone = {
  status: string;
  stopReason: string;
  garmin: "available" | "unavailable";
  listCostCents: number | null;
  timings: { sessionMs: number; firstEventMs: number | null; turnMs: number };
};

type TurnEvent =
  | TranscriptItem
  | { type: "session"; sessionId: string; consoleUrl: string }
  | { type: "question"; question: PendingQuestion }
  | ({ type: "done" } & TurnDone);

type Turn = {
  sessionId: string | null;
  consoleUrl: string | null;
  transcript: TranscriptItem[];
  pendingQuestion: PendingQuestion | null;
  done: TurnDone | null;
};

type Entry = { athlete: string; turn: Turn; failed: string | null };

const emptyTurn: Turn = {
  sessionId: null,
  consoleUrl: null,
  transcript: [],
  pendingQuestion: null,
  done: null,
};

const refusals: Record<string, string> = {
  "not-found": "Session introuvable.",
  session_closed: "Cette session est terminée. Démarre une nouvelle session.",
  turn_in_progress: "Un tour est déjà en cours dans cette session.",
  answer_required: "Réponds d’abord à la question du coach.",
  no_pending_question: "Aucune question du coach n’attend de réponse.",
};

function reduceTurn(turn: Turn, event: TurnEvent): Turn {
  if (event.type === "session")
    return {
      ...turn,
      sessionId: event.sessionId,
      consoleUrl: event.consoleUrl,
    };
  if (event.type === "question")
    return { ...turn, pendingQuestion: event.question };
  if (event.type === "done")
    return {
      ...turn,
      done: {
        status: event.status,
        stopReason: event.stopReason,
        garmin: event.garmin,
        listCostCents: event.listCostCents,
        timings: event.timings,
      },
    };
  return { ...turn, transcript: [...turn.transcript, event] };
}

async function* readEvents(response: Response) {
  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();
  if (!reader) return;
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames)
      if (frame.startsWith("data: "))
        yield JSON.parse(frame.slice(6)) as TurnEvent;
  }
}

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "USD",
});
const seconds = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

async function post(body: unknown) {
  const response = await fetch("/api/dev/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

function TranscriptLine({ item }: { item: TranscriptItem }) {
  if (item.type === "coach")
    return <p className="whitespace-pre-wrap">{item.text}</p>;
  if (item.type === "delegation")
    return (
      <details className="text-sm text-muted">
        <summary>
          {item.from} → {item.to}
        </summary>
        <p className="whitespace-pre-wrap">{item.text}</p>
      </details>
    );
  if (item.type === "tool")
    return (
      <p className="font-mono text-xs text-muted">
        outil {item.name} ({item.ok ? "ok" : "erreur"},{" "}
        {seconds.format(item.ms / 1000)} s)
      </p>
    );
  if (item.type === "mcp")
    return <p className="font-mono text-xs text-muted">Garmin {item.name}</p>;
  return <p className="text-sm text-danger">{item.text}</p>;
}

export function CoachSpike({
  hasPlan,
  planVersion,
  proposals,
}: {
  hasPlan: boolean;
  planVersion: number | null;
  proposals: Proposal[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [mode, setMode] = useState<Mode>("plan");
  const [notice, setNotice] = useState<string | null>(null);

  const sessionId =
    entries.findLast((entry) => entry.turn.sessionId)?.turn.sessionId ??
    undefined;
  const pending = entries.at(-1)?.turn.pendingQuestion ?? null;

  function updateLast(update: (entry: Entry) => Entry) {
    setEntries((current) => [...current.slice(0, -1), update(current.at(-1)!)]);
  }

  async function send() {
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setText("");
    setEntries((current) => [
      ...current,
      { athlete: message, turn: emptyTurn, failed: null },
    ]);
    try {
      const response = await fetch("/api/coach/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          mode,
          input: pending
            ? { kind: "answer", toolUseId: pending.toolUseId, text: message }
            : { kind: "message", text: message },
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        updateLast((entry) => ({
          ...entry,
          failed: refusals[data?.code] ?? "Le tour a échoué.",
        }));
      } else
        for await (const event of readEvents(response))
          updateLast((entry) => ({
            ...entry,
            turn: reduceTurn(entry.turn, event),
          }));
    } catch {
      updateLast((entry) => ({ ...entry, failed: "Le tour a échoué." }));
    }
    setBusy(false);
    router.refresh();
  }

  function submit() {
    if (!sessionId) setConfirming(true);
    else void send();
  }

  async function apply(proposalId: string) {
    setBusy(true);
    const { data } = await post({ action: "apply", proposalId });
    setNotice(
      data?.ok
        ? `Plan enregistré en version ${data.version}.`
        : `Application impossible (${data?.reason ?? "erreur"}).`,
    );
    setBusy(false);
    router.refresh();
  }

  async function deletePlan() {
    setBusy(true);
    const { data } = await post({ action: "delete-plan" });
    setNotice(data?.ok ? "Plan réinitialisé." : "Réinitialisation impossible.");
    setBusy(false);
    router.refresh();
  }

  async function decide(proposalId: string, decision: "accept" | "reject") {
    setBusy(true);
    const { ok } = await post({ action: "decide", proposalId, decision });
    setNotice(ok ? "Décision enregistrée." : "Décision impossible.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-surface bg-surface-raised p-4 text-sm">
        <p>
          {hasPlan
            ? `Plan actif en version ${planVersion}.`
            : "Aucun plan actif enregistré."}
        </p>
        {(hasPlan || proposals.length > 0) && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            Réinitialiser le plan
          </Button>
        )}
        {notice && <p className="text-muted">{notice}</p>}
      </section>

      {proposals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Propositions</h2>
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="flex flex-col gap-2 rounded-surface border border-border p-4"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline">{proposal.status}</Badge>
                <span className="font-medium">{proposal.title}</span>
              </div>
              {proposal.summary && (
                <p className="text-sm text-muted">{proposal.summary}</p>
              )}
              {proposal.weeks && (
                <details className="text-sm">
                  <summary>
                    {proposal.weeks.length} semaines ·{" "}
                    {proposal.weeks.reduce(
                      (total, week) => total + week.sessions.length,
                      0,
                    )}{" "}
                    séances
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {proposal.weeks.map((week) => (
                      <div key={week.weekStart}>
                        <p className="font-medium">
                          Semaine du {frDate(week.weekStart)} ·{" "}
                          {Math.round(week.minutes)} min
                        </p>
                        <ul className="text-muted">
                          {week.sessions.map((session, index) => (
                            <li key={index}>
                              {frDate(session.date)} · {session.title} ·{" "}
                              {Math.round(session.minutes)} min
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {proposal.status === "accepted" && (
                <Button
                  size="sm"
                  className="self-start"
                  disabled={busy}
                  onClick={() => apply(proposal.id)}
                >
                  Appliquer
                </Button>
              )}
              {proposal.status === "ready" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => decide(proposal.id, "accept")}
                  >
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => decide(proposal.id, "reject")}
                  >
                    Refuser
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-4">
        {entries.map((entry, index) => (
          <div key={index} className="flex flex-col gap-2">
            <p className="self-end rounded-control bg-surface-raised px-3 py-2">
              {entry.athlete}
            </p>
            {entry.failed && (
              <p className="text-sm text-danger">{entry.failed}</p>
            )}
            {!entry.failed && (
              <div className="flex flex-col gap-2">
                {entry.turn.transcript.map((item, line) => (
                  <TranscriptLine key={line} item={item} />
                ))}
                {entry.turn.pendingQuestion && (
                  <p className="rounded-control border border-primary px-3 py-2">
                    {entry.turn.pendingQuestion.question}
                  </p>
                )}
                {entry.turn.done && entry.turn.consoleUrl && (
                  <p className="font-mono text-xs text-muted">
                    arrêt {entry.turn.done.stopReason} · statut{" "}
                    {entry.turn.done.status} · Garmin{" "}
                    {entry.turn.done.garmin === "available"
                      ? "disponible"
                      : "indisponible"}{" "}
                    · session{" "}
                    {seconds.format(entry.turn.done.timings.sessionMs / 1000)} s
                    · premier événement{" "}
                    {entry.turn.done.timings.firstEventMs === null
                      ? "—"
                      : `${seconds.format(entry.turn.done.timings.firstEventMs / 1000)} s`}{" "}
                    · tour{" "}
                    {seconds.format(entry.turn.done.timings.turnMs / 1000)} s ·
                    coût cumulé{" "}
                    {entry.turn.done.listCostCents === null
                      ? "—"
                      : euros.format(entry.turn.done.listCostCents / 100)}{" "}
                    ·{" "}
                    <a
                      className="underline"
                      href={entry.turn.consoleUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      console
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        {!sessionId && (
          <div className="flex gap-2">
            {(["plan", "conversation"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={mode === option ? "default" : "outline"}
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
              >
                {option === "plan" ? "Génération de plan" : "Conversation"} (
                {budgets[option]})
              </Button>
            ))}
          </div>
        )}
        <Textarea
          aria-label={pending ? "Ta réponse au coach" : "Ton message au coach"}
          placeholder={
            pending ? "Réponds à la question du coach…" : "Écris au coach…"
          }
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex gap-2">
          <Button disabled={busy || !text.trim()} onClick={submit}>
            {busy ? "Le coach réfléchit…" : pending ? "Répondre" : "Envoyer"}
          </Button>
          {sessionId && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEntries([])}
            >
              Nouvelle session
            </Button>
          )}
        </div>
      </section>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Démarrer une session ?</AlertDialogTitle>
            <AlertDialogDescription>
              Une nouvelle session Managed Agents consomme des crédits API, avec
              un plafond de {budgets[mode]} pour toute la session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>
              Démarrer (budget {budgets[mode]})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le plan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le plan actif, ses versions, ses propositions et les propositions
              de nouveau plan en attente seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deletePlan()}>
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
