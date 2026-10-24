import { z } from "zod";
import {
  activityTitle,
  formatDistance,
  formatDuration,
  formatPace,
} from "@/features/activities/activities";
import { displayTimeZone } from "@/features/app-shell/shell";
import { watchFailureDetail } from "@/features/garmin/watch";
import {
  staffAgents,
  type Staff,
  type StaffAgent,
} from "@/features/coach/staff";

export const notificationWindowDays = 30;
export const notificationKinds = [
  "plan_proposal",
  "staff_reply",
  "staff_question",
  "garmin_activity",
  "garmin_connection",
  "watch_workout",
  "gear_mismatch",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

const text = z.string().trim().min(1).max(400);
const agent = z.enum(staffAgents).catch("coach");
const optionalText = text.nullable().catch(null);
const optionalNumber = z.number().nonnegative().nullable().catch(null);

export const reconnectStatuses = ["reconnect_required", "expired"] as const;

const payloads = {
  plan_proposal: z.object({
    proposalId: z.uuid(),
    title: text,
    summary: text.nullable().catch(null),
  }),
  staff_reply: z.object({
    threadId: z.uuid(),
    threadTitle: text.nullable().catch(null),
    agent,
    excerpt: text,
  }),
  staff_question: z.object({
    threadId: z.uuid(),
    threadTitle: text.nullable().catch(null),
    agent,
    question: text.nullable().catch(null),
  }),
  garmin_activity: z.object({
    activityId: z.uuid(),
    name: optionalText,
    type: optionalText,
    distanceMeters: optionalNumber,
    durationSeconds: optionalNumber,
    matched: z.boolean().catch(false),
  }),
  garmin_connection: z.object({
    connectionId: z.uuid(),
    status: z.enum([
      ...reconnectStatuses,
      "error",
      "rate_limited",
      "provider_unavailable",
    ]),
    errorCode: optionalText,
  }),
  watch_workout: z.object({
    externalKey: text,
    scheduledOn: z.iso.date(),
    status: z.enum(["failed", "needs_confirmation"]),
    errorCode: optionalText,
    sessionTitle: optionalText,
  }),
  gear_mismatch: z.object({
    activityId: z.uuid(),
    activityName: optionalText,
    sessionTitle: optionalText,
    day: z.iso.date().nullable().catch(null),
    garmin: optionalText,
    planned: optionalText,
  }),
} as const;

export const notificationRowSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  payload: z.unknown(),
  occurred_at: z.string(),
  read_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolution: z.string().nullable(),
});

export const notificationColumns =
  "id, kind, payload, occurred_at, read_at, resolved_at, resolution";

const resolutions = [
  "applied",
  "rejected",
  "replaced",
  "answered",
  "restored",
  "sent",
] as const;
type Resolution = (typeof resolutions)[number];

type Base = {
  id: string;
  occurredAt: string;
  read: boolean;
  resolution: Resolution | null;
};

export type Notification = {
  [Kind in NotificationKind]: Base & {
    kind: Kind;
    payload: z.output<(typeof payloads)[Kind]>;
  };
}[NotificationKind];

export function parseNotification(row: unknown): Notification | null {
  const parsed = notificationRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const { id, kind, payload, occurred_at, read_at, resolved_at, resolution } =
    parsed.data;
  if (!(notificationKinds as readonly string[]).includes(kind)) return null;
  const body = payloads[kind as NotificationKind].safeParse(payload);
  if (!body.success || Number.isNaN(Date.parse(occurred_at))) return null;
  const resolved = resolved_at
    ? (z.enum(resolutions).safeParse(resolution).data ?? null)
    : null;
  return {
    id,
    kind,
    payload: body.data,
    occurredAt: occurred_at,
    read: read_at !== null,
    resolution: resolved,
  } as Notification;
}

export function parseNotifications(rows: unknown) {
  return z
    .array(z.unknown())
    .catch([])
    .parse(rows)
    .flatMap((row) => {
      const notification = parseNotification(row);
      return notification ? [notification] : [];
    });
}

export const notificationFilters = ["all", "todo", "staff", "data"] as const;
export type NotificationFilter = (typeof notificationFilters)[number];

export const filterLabels: Record<NotificationFilter, string> = {
  all: "Toutes",
  todo: "À traiter",
  staff: "Staff",
  data: "Données",
};

export function parseFilter(value: unknown): NotificationFilter {
  return z.enum(notificationFilters).catch("all").parse(value);
}

export function filterHref(filter: NotificationFilter) {
  return filter === "all"
    ? "/notifications"
    : `/notifications?filter=${filter}`;
}

export const todoKinds = [
  "plan_proposal",
  "staff_question",
  "garmin_connection",
  "watch_workout",
  "gear_mismatch",
] as const satisfies readonly NotificationKind[];

export const todoPayloadFilter = `kind.neq.garmin_connection,payload->>status.in.(${reconnectStatuses.join(",")})`;

export const filterKinds: Record<
  NotificationFilter,
  readonly NotificationKind[]
> = {
  all: notificationKinds,
  todo: todoKinds,
  staff: ["staff_reply", "staff_question"],
  data: [
    "garmin_activity",
    "garmin_connection",
    "watch_workout",
    "gear_mismatch",
  ],
};

function needsReconnect(status: string) {
  return (reconnectStatuses as readonly string[]).includes(status);
}

export function isTodo(notification: Notification) {
  if (notification.resolution !== null) return false;
  if (notification.kind === "garmin_connection")
    return needsReconnect(notification.payload.status);
  return (todoKinds as readonly NotificationKind[]).includes(notification.kind);
}

export function matchesFilter(
  notification: Notification,
  filter: NotificationFilter,
) {
  if (filter === "todo") return isTodo(notification);
  return filterKinds[filter].includes(notification.kind);
}

export function notificationHref(notification: Notification) {
  switch (notification.kind) {
    case "plan_proposal":
      return `/plan?proposal=${notification.payload.proposalId}`;
    case "garmin_activity":
    case "gear_mismatch":
      return `/activities/${notification.payload.activityId}`;
    case "garmin_connection":
      return "/settings/connections/garmin";
    case "watch_workout":
      return "/plan";
    default:
      return `/coach/${notification.payload.threadId}`;
  }
}

export function notificationTarget(row: unknown) {
  const notification = row ? parseNotification(row) : null;
  return notification ? notificationHref(notification) : "/notifications";
}

export type NotificationStatus = {
  label: string;
  tone: "warning" | "success" | "muted";
};

export type NotificationFamily =
  "plan" | "staff" | "activity" | "sync" | "watch" | "shoe";

export type NotificationView = {
  id: string;
  family: NotificationFamily;
  agent: StaffAgent | null;
  title: string;
  body: string | null;
  href: string;
  unread: boolean;
  todo: boolean;
  status: NotificationStatus | null;
  action: string | null;
  occurredAt: string;
  time: string;
};

const resolvedProposal: Record<Resolution, NotificationStatus> = {
  applied: { label: "Appliqué", tone: "success" },
  rejected: { label: "Refusée", tone: "muted" },
  replaced: { label: "Remplacée", tone: "muted" },
  answered: { label: "Remplacée", tone: "muted" },
  restored: { label: "Remplacée", tone: "muted" },
  sent: { label: "Remplacée", tone: "muted" },
};

const toReview: NotificationStatus = { label: "À traiter", tone: "warning" };

const scheduledDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatScheduledDay(day: string) {
  return scheduledDay.format(new Date(`${day}T00:00:00Z`));
}

const pendingSync = "Reprise automatique, rien à faire de ton côté.";

const syncDetails: Record<string, string> = {
  rate_limited: `Garmin limite les échanges pour le moment. ${pendingSync}`,
  provider_unavailable: `Garmin ne répond pas pour le moment. ${pendingSync}`,
  error: `La dernière synchronisation a échoué. ${pendingSync}`,
};

type GarminView = Pick<
  NotificationView,
  "family" | "title" | "body" | "status" | "action"
>;

function activityBody({
  distanceMeters,
  durationSeconds,
}: {
  distanceMeters: number | null;
  durationSeconds: number | null;
}) {
  const parts = [
    distanceMeters ? `${formatDistance(distanceMeters)} km` : null,
    durationSeconds ? formatDuration(durationSeconds) : null,
    distanceMeters && durationSeconds
      ? `${formatPace(distanceMeters, durationSeconds)} /km`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

type GarminNotification = Extract<
  Notification,
  {
    kind:
      | "garmin_activity"
      | "garmin_connection"
      | "watch_workout"
      | "gear_mismatch";
  }
>;

function garminView(notification: GarminNotification): GarminView {
  const resolution = notification.resolution;
  switch (notification.kind) {
    case "garmin_activity": {
      const { name, type, matched } = notification.payload;
      return {
        family: "activity",
        title: `Nouvelle activité : ${activityTitle({ name, type, routeName: null })}`,
        body: [
          matched ? "Associée à ta séance" : "Sans séance prévue",
          activityBody(notification.payload),
        ]
          .filter(Boolean)
          .join(" · "),
        status: null,
        action: null,
      };
    }
    case "garmin_connection": {
      const { status } = notification.payload;
      const restored: NotificationStatus | null =
        resolution === "restored"
          ? { label: "Rétablie", tone: "success" }
          : resolution
            ? { label: "Remplacée", tone: "muted" }
            : null;
      if (needsReconnect(status))
        return {
          family: "sync",
          title: "Reconnecte ton compte Garmin",
          body: "Garmin demande une nouvelle connexion : tes activités et ta récupération ne sont plus importées.",
          status: restored ?? toReview,
          action: resolution ? null : "Reconnecter",
        };
      return {
        family: "sync",
        title: "Synchronisation Garmin interrompue",
        body: syncDetails[status] ?? syncDetails.error,
        status: restored,
        action: null,
      };
    }
    case "watch_workout": {
      const { scheduledOn, sessionTitle, status, errorCode } =
        notification.payload;
      const session = `${sessionTitle ?? "Séance"} du ${formatScheduledDay(scheduledOn)}`;
      const failed = status === "failed";
      return {
        family: "watch",
        title:
          resolution === "sent"
            ? `${session} envoyée sur ta montre`
            : failed
              ? `${session} pas envoyée sur ta montre`
              : `${session} à confirmer pour ta montre`,
        body: failed
          ? watchFailureDetail(errorCode)
          : "Ta montre ne peut pas afficher toute la séance : confirme l’envoi depuis ton plan.",
        status:
          resolution === "sent"
            ? { label: "Envoyée", tone: "success" }
            : resolution
              ? { label: "Remplacée", tone: "muted" }
              : toReview,
        action: resolution ? null : "Voir la séance",
      };
    }
    case "gear_mismatch": {
      const { activityName, sessionTitle, garmin, planned } =
        notification.payload;
      return {
        family: "shoe",
        title: `Quelle paire pour ${activityName ?? sessionTitle ?? "ta sortie"} ?`,
        body:
          garmin && planned
            ? `Garmin indique les ${garmin}, la séance prévoyait les ${planned}.`
            : null,
        status: resolution ? { label: "Répondu", tone: "success" } : toReview,
        action: resolution ? null : "Choisir la paire",
      };
    }
  }
}

const clock = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});

function about(title: string | null) {
  return title ? ` sur « ${title} »` : "";
}

export function notificationView(
  notification: Notification,
  staff: Staff,
): NotificationView {
  const base = {
    id: notification.id,
    href: notificationHref(notification),
    unread: !notification.read,
    todo: isTodo(notification),
    occurredAt: notification.occurredAt,
    time: clock.format(new Date(notification.occurredAt)),
  };
  if (notification.kind === "plan_proposal") {
    const { title, summary } = notification.payload;
    return {
      ...base,
      family: "plan",
      agent: null,
      title: `${staff.coach.name} propose : ${title}`,
      body: summary,
      status: notification.resolution
        ? resolvedProposal[notification.resolution]
        : { label: "À traiter", tone: "warning" },
      action: notification.resolution ? null : "Voir la proposition",
    };
  }
  if (notification.kind === "staff_question") {
    const { agent, question, threadTitle } = notification.payload;
    return {
      ...base,
      family: "staff",
      agent,
      title: `${staff[agent].name} t’a posé une question`,
      body: question ? `« ${question} »` : threadTitle,
      status: notification.resolution
        ? { label: "Répondu", tone: "success" }
        : { label: "Réponse attendue", tone: "warning" },
      action: notification.resolution ? null : "Répondre",
    };
  }
  if (notification.kind !== "staff_reply")
    return { ...base, ...garminView(notification), agent: null };
  const { agent, excerpt, threadTitle } = notification.payload;
  return {
    ...base,
    family: "staff",
    agent,
    title: `${staff[agent].name} a répondu${about(threadTitle)}`,
    body: excerpt,
    status: null,
    action: null,
  };
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: displayTimeZone });
const weekday = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  timeZone: displayTimeZone,
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: displayTimeZone,
});

function shiftDay(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayLabel(
  iso: string,
  now: Date,
  { withDate = false }: { withDate?: boolean } = {},
) {
  const date = new Date(iso);
  const key = dayKey.format(date);
  const today = dayKey.format(now);
  const full = `${weekday.format(date)} ${dayMonth.format(date)}`;
  const relative =
    key === today ? "Aujourd’hui" : key === shiftDay(today, -1) ? "Hier" : null;
  if (!relative) return full;
  return withDate ? `${relative} · ${full}` : relative;
}

export type NotificationDay = {
  key: string;
  label: string;
  items: NotificationView[];
};

export function groupByDay(
  views: readonly NotificationView[],
  now: Date,
  options: { withDate?: boolean } = {},
): NotificationDay[] {
  const days: NotificationDay[] = [];
  for (const view of [...views].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  )) {
    const key = dayKey.format(new Date(view.occurredAt));
    const last = days.at(-1);
    if (last?.key === key) last.items.push(view);
    else
      days.push({
        key,
        label: dayLabel(view.occurredAt, now, options),
        items: [view],
      });
  }
  return days;
}

export function windowStart(now: Date) {
  return new Date(now.getTime() - notificationWindowDays * 86_400_000);
}

export type NotificationFeed = {
  items: Notification[];
  unread: number;
  todo: number;
};

export function unreadLabel(count: number) {
  if (count === 0) return "Aucune non lue";
  return count > 1 ? `${count} non lues` : "1 non lue";
}

export function bellLabel(count: number) {
  return count > 0 ? `Notifications, ${unreadLabel(count)}` : "Notifications";
}

export function badgeValue(count: number) {
  return count > 99 ? "99+" : String(count);
}
