import { z } from "zod";
import { displayTimeZone } from "@/features/app-shell/shell";
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
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

const text = z.string().trim().min(1).max(400);
const agent = z.enum(staffAgents).catch("coach");

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

const resolutions = ["applied", "rejected", "replaced", "answered"] as const;
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

export const notificationFilters = [
  "toutes",
  "a-traiter",
  "staff",
  "donnees",
] as const;
export type NotificationFilter = (typeof notificationFilters)[number];

export const filterLabels: Record<NotificationFilter, string> = {
  toutes: "Toutes",
  "a-traiter": "À traiter",
  staff: "Staff",
  donnees: "Données",
};

export function parseFilter(value: unknown): NotificationFilter {
  return z.enum(notificationFilters).catch("toutes").parse(value);
}

export function filterHref(filter: NotificationFilter) {
  return filter === "toutes"
    ? "/notifications"
    : `/notifications?filtre=${filter}`;
}

export const todoKinds = [
  "plan_proposal",
  "staff_question",
] as const satisfies readonly NotificationKind[];

export const filterKinds: Record<
  NotificationFilter,
  readonly NotificationKind[]
> = {
  toutes: notificationKinds,
  "a-traiter": todoKinds,
  staff: ["staff_reply", "staff_question"],
  donnees: [],
};

export function isTodo(notification: Notification) {
  return (
    notification.resolution === null &&
    (todoKinds as readonly NotificationKind[]).includes(notification.kind)
  );
}

export function matchesFilter(
  notification: Notification,
  filter: NotificationFilter,
) {
  if (filter === "a-traiter") return isTodo(notification);
  return filterKinds[filter].includes(notification.kind);
}

export function notificationHref(notification: Notification) {
  if (notification.kind === "plan_proposal")
    return `/plan?proposition=${notification.payload.proposalId}`;
  return `/coach/${notification.payload.threadId}`;
}

export function notificationTarget(row: unknown) {
  const notification = row ? parseNotification(row) : null;
  return notification ? notificationHref(notification) : "/notifications";
}

export type NotificationStatus = {
  label: string;
  tone: "warning" | "success" | "muted";
};

export type NotificationView = {
  id: string;
  family: "plan" | "staff";
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
};

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
