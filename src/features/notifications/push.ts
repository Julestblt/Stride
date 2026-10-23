import { z } from "zod";
import {
  formatDistance,
  formatDuration as formatClock,
} from "@/features/activities/activities";
import {
  defaultStaffFaces,
  staffFacesSchema,
  staffOf,
} from "@/features/coach/staff";
import { formatDuration, formatLongDay } from "@/features/plans/view/format";
import {
  notificationHref,
  notificationView,
  parseNotification,
  type NotificationKind,
} from "./model";

export const pushCategories = [
  "session_reminder",
  "plan_staff",
  "debrief",
  "garmin_issues",
] as const;
export type PushCategory = (typeof pushCategories)[number];
export type PushPreferences = Record<PushCategory, boolean>;

export const defaultPushPreferences: PushPreferences = {
  session_reminder: true,
  plan_staff: true,
  debrief: true,
  garmin_issues: true,
};

export const pushCategoryCopy: Record<
  PushCategory,
  { label: string; hint: string }
> = {
  session_reminder: {
    label: "Séance du jour",
    hint: "Le matin d’une séance, 07:00",
  },
  plan_staff: {
    label: "Plan et staff",
    hint: "Changement du plan à valider, réponse ou question du staff",
  },
  debrief: {
    label: "Débrief prêt",
    hint: "Dès qu’une sortie Garmin est importée",
  },
  garmin_issues: {
    label: "Problèmes Garmin",
    hint: "Synchro interrompue, séance non envoyée sur la montre",
  },
};

export const pushCategoryOf: Partial<Record<NotificationKind, PushCategory>> = {
  plan_proposal: "plan_staff",
  staff_reply: "plan_staff",
  staff_question: "plan_staff",
  garmin_activity: "debrief",
  garmin_connection: "garmin_issues",
  watch_workout: "garmin_issues",
};

export const reminderKind = "session_reminder";

export const pushPreferencesSchema = z.object({
  session_reminder: z.boolean().catch(true),
  plan_staff: z.boolean().catch(true),
  debrief: z.boolean().catch(true),
  garmin_issues: z.boolean().catch(true),
});

export const pushPreferenceChangeSchema = z.strictObject({
  category: z.enum(pushCategories),
  enabled: z.boolean(),
});

const pushServiceHosts = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushEndpoint(value: string) {
  if (!URL.canParse(value)) return false;
  const { hostname } = new URL(value);
  return pushServiceHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export const pushEndpointSchema = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .refine(isPushEndpoint);

const keysShape = {
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(128),
};

export const pushSubscriptionSchema = z.strictObject({
  endpoint: pushEndpointSchema,
  keys: z.strictObject(keysShape),
  label: z.string().trim().min(1).max(60).nullable(),
});

export const pushDeliverySchema = z.object({
  id: z.uuid(),
  subscription: z.object({
    id: z.uuid(),
    endpoint: pushEndpointSchema,
    keys: z.object(keysShape),
  }),
  kind: z.string().min(1).max(40),
  payload: z.unknown(),
  occurredAt: z.string(),
  faces: z.unknown(),
});
export type PushDelivery = z.output<typeof pushDeliverySchema>;

export const pushDeliveryTargetSchema = z.object({
  subscription: z.object({ id: z.uuid(), endpoint: z.string() }),
});

export const pushDispatchSchema = z.object({
  deliveries: z.array(z.unknown()).max(50),
});

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

const reminderSchema = z.object({
  day: z.iso.date(),
  sessions: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        durationSeconds: z.number().positive().nullable().catch(null),
      }),
    )
    .min(1)
    .max(10),
});

function reminderMessage(payload: unknown): PushMessage | null {
  const parsed = reminderSchema.safeParse(payload);
  if (!parsed.success) return null;
  const [first, ...others] = parsed.data.sessions;
  const details = [
    first.durationSeconds ? formatDuration(first.durationSeconds) : null,
    others.length === 1
      ? "+ 1 autre séance"
      : others.length > 1
        ? `+ ${others.length} autres séances`
        : null,
  ].filter(Boolean);
  return {
    title: `Séance du jour : ${first.title}`,
    body: details.length
      ? `${details.join(" · ")} · ouvre Aujourd’hui pour le détail et ta paire.`
      : "Ouvre Aujourd’hui pour le détail et ta paire.",
    url: "/today",
    tag: `session_reminder:${parsed.data.day}`,
  };
}

export function pushMessage(delivery: PushDelivery): PushMessage | null {
  if (delivery.kind === reminderKind) return reminderMessage(delivery.payload);
  const notification = parseNotification({
    id: delivery.id,
    kind: delivery.kind,
    payload: delivery.payload,
    occurred_at: delivery.occurredAt,
    read_at: null,
    resolved_at: null,
    resolution: null,
  });
  if (!notification || !pushCategoryOf[notification.kind]) return null;
  const staff = staffOf(
    staffFacesSchema.catch(defaultStaffFaces).parse(delivery.faces),
  );
  const url = notificationHref(notification);
  const tag = `${notification.kind}:${url}`;
  if (notification.kind === "staff_reply") {
    const { agent, excerpt } = notification.payload;
    return {
      title: `${staff[agent].name} a répondu`,
      body: `« ${excerpt} »`,
      url,
      tag,
    };
  }
  if (notification.kind === "garmin_activity") {
    const { distanceMeters, durationSeconds } = notification.payload;
    return {
      title: "Débrief prêt",
      body:
        distanceMeters && durationSeconds
          ? `Sortie de ${formatDistance(distanceMeters)} km en ${formatClock(durationSeconds)} importée depuis Garmin.`
          : "Ta sortie est importée depuis Garmin.",
      url,
      tag,
    };
  }
  if (
    notification.kind === "watch_workout" &&
    notification.payload.status === "failed"
  ) {
    const { sessionTitle, scheduledOn } = notification.payload;
    const session = sessionTitle ? `« ${sessionTitle} »` : "Ta séance";
    return {
      title: "Séance non envoyée sur la montre",
      body: `${session} du ${formatLongDay(scheduledOn)} n’a pas pu partir. Ouvre ton plan pour réessayer.`,
      url,
      tag,
    };
  }
  const view = notificationView(notification, staff);
  return { title: view.title, body: view.body ?? "", url, tag };
}

export function pushTimeToLive(kind: string) {
  return kind === reminderKind ? 12 * 3600 : 24 * 3600;
}

export type DeviceLabel =
  "iPhone" | "iPad" | "Android" | "Mac" | "Windows" | "Linux";

export function deviceLabel(
  userAgent: string,
  maxTouchPoints = 0,
): DeviceLabel | null {
  if (/iPhone|iPod/.test(userAgent)) return "iPhone";
  if (/iPad/.test(userAgent)) return "iPad";
  if (/Android/.test(userAgent)) return "Android";
  if (/Macintosh/.test(userAgent)) return maxTouchPoints > 1 ? "iPad" : "Mac";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Linux/.test(userAgent)) return "Linux";
  return null;
}

export function isAppleMobile(label: DeviceLabel | null) {
  return label === "iPhone" || label === "iPad";
}

export function deviceName(label: DeviceLabel | null) {
  if (label === "iPhone") return "Sur cet iPhone";
  if (label === "iPad") return "Sur cet iPad";
  return "Sur ce navigateur";
}

export type PushDeviceState =
  | "checking"
  | "unavailable"
  | "install"
  | "unsupported"
  | "denied"
  | "off"
  | "on";

export function pushDeviceState({
  configured,
  appleMobile,
  standalone,
  supported,
  permission,
  subscribed,
}: {
  configured: boolean;
  appleMobile: boolean;
  standalone: boolean;
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}): Exclude<PushDeviceState, "checking"> {
  if (!configured) return "unavailable";
  if (appleMobile && !standalone) return "install";
  if (!supported) return "unsupported";
  if (permission === "denied") return "denied";
  return subscribed ? "on" : "off";
}

export function applicationServerKey(publicKey: string) {
  const base64 = (publicKey + "=".repeat((4 - (publicKey.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
