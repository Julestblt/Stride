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
  | { type: "error"; text: string };

type Turn = {
  sessionId: string;
  consoleUrl: string;
  transcript: TranscriptItem[];
  pendingQuestion: {
    toolUseId: string;
    question: string;
    askedFor: string;
  } | null;
  stopReason: string;
  listCostCents: number | null;
  timings: { sessionMs: number; firstEventMs: number | null; turnMs: number };
};

type Entry = { athlete: string; turn: Turn | null; failed: boolean };

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

  const last = entries.at(-1)?.turn ?? null;
  const sessionId = last?.sessionId;
  const pending = last?.pendingQuestion ?? null;

  async function send() {
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setText("");
    setEntries((current) => [
      ...current,
      { athlete: message, turn: null, failed: false },
    ]);
    const { ok, data } = await post({
      action: "turn",
      sessionId,
      mode,
      input: pending
        ? { kind: "answer", toolUseId: pending.toolUseId, text: message }
        : { kind: "message", text: message },
    });
    setEntries((current) => [
      ...current.slice(0, -1),
      { athlete: message, turn: ok ? (data as Turn) : null, failed: !ok },
    ]);
    setBusy(false);
    router.refresh();
  }

  function submit() {
    if (!sessionId) setConfirming(true);
    else void send();
  }

  async function seed() {
    setBusy(true);
    const { data } = await post({ action: "seed" });
    setNotice(
      data?.ok
        ? `Proposition de plan acceptée (${data.proposalId}). Elle doit encore être appliquée.`
        : "Impossible de créer le plan depuis le brouillon.",
    );
    setBusy(false);
    router.refresh();
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
    setNotice(data?.ok ? "Plan supprimé." : "Suppression impossible.");
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
        {hasPlan ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            Supprimer le plan
          </Button>
        ) : (
          <Button variant="outline" disabled={busy} onClick={seed}>
            Enregistrer le brouillon comme plan
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
              <p className="text-sm text-danger">Le tour a échoué.</p>
            )}
            {entry.turn && (
              <div className="flex flex-col gap-2">
                {entry.turn.transcript.map((item, line) => (
                  <TranscriptLine key={line} item={item} />
                ))}
                {entry.turn.pendingQuestion && (
                  <p className="rounded-control border border-primary px-3 py-2">
                    {entry.turn.pendingQuestion.question}
                  </p>
                )}
                <p className="font-mono text-xs text-muted">
                  arrêt {entry.turn.stopReason} · session{" "}
                  {seconds.format(entry.turn.timings.sessionMs / 1000)} s ·
                  premier événement{" "}
                  {entry.turn.timings.firstEventMs === null
                    ? "—"
                    : `${seconds.format(entry.turn.timings.firstEventMs / 1000)} s`}{" "}
                  · tour {seconds.format(entry.turn.timings.turnMs / 1000)} s ·
                  coût cumulé{" "}
                  {entry.turn.listCostCents === null
                    ? "—"
                    : euros.format(entry.turn.listCostCents / 100)}{" "}
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
              un plafond de 1 $ pour toute la session.
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
            <AlertDialogTitle>Supprimer le plan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le plan actif, ses versions et ses propositions seront supprimés
              définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deletePlan()}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
