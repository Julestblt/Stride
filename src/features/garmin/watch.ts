import { displayTimeZone } from "@/features/app-shell/shell";
import { addDays } from "@/features/plans/model/dates";
import type { PlanSession } from "@/features/plans/model/plan";
import { formatLongDay } from "@/features/plans/view/format";

export const watchHorizonDays = 7;
export const watchMaxDays = 31;
export const watchMaxWorkouts = 40;

export const watchRowStatuses = [
  "sent",
  "failed",
  "needs_confirmation",
] as const;
export type WatchRowStatus = (typeof watchRowStatuses)[number];

export type WatchRow = {
  key: string;
  scheduledOn: string;
  status: WatchRowStatus;
  errorCode: string | null;
  simplifications: string[];
  sentAt: string | null;
};

export type WatchWorkout = {
  key: string;
  date: string;
  name: string;
  description: string;
  steps: PlanSession["structure"];
  force?: true;
  allow_simplified?: true;
};

export type WatchRequest = {
  from: string;
  to: string;
  workouts: WatchWorkout[];
};

export type WatchReconcileResult = {
  workouts: { key: string; status: WatchRowStatus; errorCode: string | null }[];
  removed: string[];
};

export type WatchIntent = {
  sessionKey: string;
  force?: boolean;
  allowSimplified?: boolean;
};

export function watchKey(planId: string, sessionKey: string) {
  return `${planId}:${sessionKey}`;
}

export function watchSyncKey(planId: string, version: number, today: string) {
  return `${planId}:${version}:${today}`;
}

export function isWatchable(session: PlanSession) {
  return (
    (session.sport === "run" || session.sport === "trail") &&
    session.kind !== "rest" &&
    session.structure.length > 0
  );
}

function sessionForKey(
  planId: string,
  sessions: PlanSession[],
  key: string,
): PlanSession | undefined {
  const prefix = `${planId}:`;
  if (!key.startsWith(prefix)) return undefined;
  const sessionKey = key.slice(prefix.length);
  return sessions.find((session) => session.sessionKey === sessionKey);
}

export function buildWatchRequest({
  planId,
  sessions,
  today,
  rows,
  intent,
}: {
  planId: string;
  sessions: PlanSession[];
  today: string;
  rows: WatchRow[];
  intent?: WatchIntent;
}): WatchRequest {
  const horizonEnd = addDays(today, watchHorizonDays - 1);
  const limit = addDays(today, watchMaxDays - 1);
  const inRange = (session: PlanSession, end: string) =>
    isWatchable(session) &&
    session.scheduledOn >= today &&
    session.scheduledOn <= end;
  const chosen = new Map<string, PlanSession>();
  for (const session of sessions)
    if (inRange(session, horizonEnd)) chosen.set(session.sessionKey, session);
  for (const row of rows) {
    const session = sessionForKey(planId, sessions, row.key);
    if (session && inRange(session, limit))
      chosen.set(session.sessionKey, session);
  }
  const target = intent
    ? sessions.find((session) => session.sessionKey === intent.sessionKey)
    : undefined;
  if (target && inRange(target, limit)) chosen.set(target.sessionKey, target);
  const confirmed = new Set(
    rows
      .filter(
        (row) =>
          (row.status === "sent" || row.status === "failed") &&
          row.simplifications.length > 0,
      )
      .map((row) => row.key),
  );
  const byDate = (a: PlanSession, b: PlanSession) =>
    a.scheduledOn.localeCompare(b.scheduledOn);
  const workouts = [...chosen.values()]
    .toSorted(
      (a, b) =>
        Number(b.sessionKey === target?.sessionKey) -
          Number(a.sessionKey === target?.sessionKey) || byDate(a, b),
    )
    .slice(0, watchMaxWorkouts)
    .toSorted(byDate)
    .map((session): WatchWorkout => {
      const workout: WatchWorkout = {
        key: watchKey(planId, session.sessionKey),
        date: session.scheduledOn,
        name: session.title,
        description: session.purpose,
        steps: session.structure,
      };
      const chosenByAthlete = session.sessionKey === target?.sessionKey;
      if (chosenByAthlete && intent?.force) workout.force = true;
      if (
        session.kind === "fartlek" ||
        confirmed.has(workout.key) ||
        (chosenByAthlete && intent?.allowSimplified)
      )
        workout.allow_simplified = true;
      return workout;
    });
  const dates = [
    ...workouts.map((workout) => workout.date),
    ...rows.map((row) => row.scheduledOn).filter((date) => date <= limit),
  ];
  const to = dates.reduce((end, date) => (date > end ? date : end), horizonEnd);
  return { from: today, to, workouts };
}

export type WatchAction = "send" | "resend" | "retry" | "confirm";

export type WatchState =
  | { kind: "unsupported" }
  | { kind: "scheduled"; sendsOn: string; sendable: boolean }
  | { kind: "pending" }
  | { kind: "sent"; sentAt: string | null }
  | { kind: "failed"; errorCode: string | null }
  | { kind: "needs_confirmation" };

export function watchState({
  session,
  today,
  row,
}: {
  session: PlanSession;
  today: string;
  row: WatchRow | null;
}): WatchState | null {
  if (session.scheduledOn < today) return null;
  if (session.sport === "rest" || session.kind === "rest") return null;
  if (!isWatchable(session)) return { kind: "unsupported" };
  const current = row?.scheduledOn === session.scheduledOn ? row : null;
  if (current?.status === "sent")
    return { kind: "sent", sentAt: current.sentAt };
  if (current?.status === "failed")
    return { kind: "failed", errorCode: current.errorCode };
  if (current?.status === "needs_confirmation")
    return { kind: "needs_confirmation" };
  const sendsOn = addDays(session.scheduledOn, 1 - watchHorizonDays);
  return sendsOn > today
    ? {
        kind: "scheduled",
        sendsOn,
        sendable: session.scheduledOn <= addDays(today, watchMaxDays - 1),
      }
    : { kind: "pending" };
}

export type WatchCopy = {
  tone: "muted" | "success" | "warning" | "danger";
  title: string;
  detail: string;
  action: { kind: WatchAction; label: string } | null;
};

const sentAtFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});

function sentAtLabel(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    sentAtFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month} à ${parts.hour}:${parts.minute}`;
}

export function watchFailureDetail(code: string | null) {
  if (code === "unsupported_data")
    return "Garmin a refusé cette séance. Réessaie, ou garde-la dans Stride.";
  if (code === "rate_limited")
    return "Garmin limite les envois pour le moment. Je réessaie au prochain passage.";
  return "Garmin n’a pas répondu. Je réessaie au prochain passage.";
}

export function watchCopy(
  state: WatchState,
  { pendingChange = false }: { pendingChange?: boolean } = {},
): WatchCopy {
  switch (state.kind) {
    case "unsupported":
      return {
        tone: "muted",
        title: "Reste dans Stride",
        detail:
          "Le renfo, la mobilité et le cross ne partent pas encore sur la montre.",
        action: null,
      };
    case "scheduled":
      return {
        tone: "muted",
        title: `Envoi prévu le ${formatLongDay(state.sendsOn)}`,
        detail: state.sendable
          ? "Elle part seule 7 jours avant. Tu peux l’envoyer dès maintenant."
          : "Elle part seule 7 jours avant.",
        action: state.sendable
          ? { kind: "send", label: "Envoyer sur la montre" }
          : null,
      };
    case "pending":
      return {
        tone: "muted",
        title: "Pas encore sur ta montre",
        detail: "Elle part au prochain passage de Stride.",
        action: { kind: "send", label: "Envoyer sur la montre" },
      };
    case "sent": {
      const when = sentAtLabel(state.sentAt);
      return {
        tone: "success",
        title: "Sur ta montre",
        detail: pendingChange
          ? "Si tu acceptes le changement, je mets la montre à jour tout de suite."
          : `${when ? `Envoyée ${when}. ` : ""}Lance-la depuis Entraînements sur ta montre.`,
        action: { kind: "resend", label: "Renvoyer sur la montre" },
      };
    }
    case "failed":
      return {
        tone: "danger",
        title: "Pas sur ta montre",
        detail: watchFailureDetail(state.errorCode),
        action: { kind: "retry", label: "Réessayer" },
      };
    case "needs_confirmation":
      return {
        tone: "warning",
        title: "Ta montre ne peut pas afficher toute la séance",
        detail:
          "Les étapes guidées à l’effort partent sans cible : l’effort reste écrit dans la note de l’étape.",
        action: { kind: "confirm", label: "Envoyer quand même" },
      };
  }
}

export type WatchDayTag = "on" | "off";

export function watchDayTag(state: WatchState | null): WatchDayTag | null {
  if (state?.kind === "sent") return "on";
  if (state?.kind === "failed") return "off";
  return null;
}

export function watchIntent(
  sessionKey: string,
  action: WatchAction,
): WatchIntent {
  return {
    sessionKey,
    force: action === "resend" || undefined,
    allowSimplified: action === "confirm" || undefined,
  };
}

export function watchRowFor(
  rows: WatchRow[],
  planId: string,
  sessionKey: string,
) {
  const key = watchKey(planId, sessionKey);
  return rows.find((row) => row.key === key) ?? null;
}

export function watchDayTags({
  enabled,
  rows,
  planId,
  sessions,
  today,
}: {
  enabled: boolean;
  rows: WatchRow[];
  planId: string;
  sessions: PlanSession[];
  today: string;
}): Record<string, WatchDayTag> {
  if (!enabled) return {};
  const tags: Record<string, WatchDayTag> = {};
  for (const session of sessions) {
    const tag = watchDayTag(
      watchState({
        session,
        today,
        row: watchRowFor(rows, planId, session.sessionKey),
      }),
    );
    if (tag) tags[session.sessionKey] = tag;
  }
  return tags;
}

export type WatchUpcoming = {
  sessionKey: string;
  day: string;
  title: string;
  state: WatchState;
  copy: WatchCopy;
  pendingChange: boolean;
};

export function watchUpcoming({
  rows,
  planId,
  sessions,
  today,
  pendingKeys = [],
}: {
  rows: WatchRow[];
  planId: string;
  sessions: PlanSession[];
  today: string;
  pendingKeys?: string[];
}): WatchUpcoming[] {
  const end = addDays(today, watchHorizonDays - 1);
  return sessions
    .filter(
      (session) => session.scheduledOn >= today && session.scheduledOn <= end,
    )
    .toSorted((a, b) => a.scheduledOn.localeCompare(b.scheduledOn))
    .flatMap((session) => {
      const state = watchState({
        session,
        today,
        row: watchRowFor(rows, planId, session.sessionKey),
      });
      if (!state) return [];
      const pendingChange = pendingKeys.includes(session.sessionKey);
      return [
        {
          sessionKey: session.sessionKey,
          day: formatLongDay(session.scheduledOn),
          title: session.title,
          state,
          copy: watchCopy(state, { pendingChange }),
          pendingChange,
        },
      ];
    });
}

export function watchRowLabel(
  state: WatchState,
  { pendingChange = false }: { pendingChange?: boolean } = {},
): { tone: WatchCopy["tone"]; label: string } {
  switch (state.kind) {
    case "sent":
      return pendingChange
        ? { tone: "warning", label: "Mise à jour si tu acceptes le changement" }
        : { tone: "success", label: "Envoyée" };
    case "failed":
      return {
        tone: "danger",
        label:
          state.errorCode === "unsupported_data"
            ? "Refusée par Garmin"
            : "Garmin n’a pas répondu",
      };
    case "needs_confirmation":
      return { tone: "warning", label: "À confirmer · effort sans cible" };
    case "unsupported":
      return {
        tone: "muted",
        label: "Reste dans Stride · pas encore pris en charge",
      };
    default:
      return { tone: "muted", label: "Pas encore envoyée" };
  }
}

export function latestSentAt(rows: WatchRow[]) {
  return rows.reduce<string | null>(
    (latest, row) =>
      row.sentAt && (!latest || row.sentAt > latest) ? row.sentAt : latest,
    null,
  );
}

export function watchSentLabel(iso: string | null) {
  return sentAtLabel(iso);
}
