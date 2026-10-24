import "server-only";
import {
  filterKinds,
  notificationColumns,
  parseNotifications,
  todoKinds,
  todoPayloadFilter,
  windowStart,
  type NotificationFeed,
  type NotificationFilter,
} from "@/features/notifications/model";
import type { OnboardingContext } from "@/server/onboarding/context";

export async function readNotifications(
  context: OnboardingContext,
  {
    limit = 200,
    filter = "all",
    now = new Date(),
  }: { limit?: number; filter?: NotificationFilter; now?: Date } = {},
) {
  const kinds = filterKinds[filter];
  if (!kinds.length) return [];
  let query = context.client
    .from("notifications")
    .select(notificationColumns)
    .eq("user_id", context.userId)
    .gte("occurred_at", windowStart(now).toISOString())
    .in("kind", [...kinds]);
  if (filter === "todo")
    query = query.is("resolved_at", null).or(todoPayloadFilter);
  const { data, error } = await query
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to read the notifications");
  return parseNotifications(data);
}

async function countWhere(
  context: OnboardingContext,
  now: Date,
  scope: "unread" | "todo",
) {
  let query = context.client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .gte("occurred_at", windowStart(now).toISOString());
  query =
    scope === "unread"
      ? query.is("read_at", null)
      : query
          .is("resolved_at", null)
          .in("kind", [...todoKinds])
          .or(todoPayloadFilter);
  const { count, error } = await query;
  if (error) throw new Error("Unable to count the notifications");
  return count ?? 0;
}

export function countUnread(context: OnboardingContext, now = new Date()) {
  return countWhere(context, now, "unread");
}

export async function countUnreadInThread(
  context: OnboardingContext,
  threadId: string,
) {
  const { count, error } = await context.client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .eq("payload->>threadId", threadId)
    .is("read_at", null);
  if (error) throw new Error("Unable to count the thread notifications");
  return count ?? 0;
}

export function countTodo(context: OnboardingContext, now = new Date()) {
  return countWhere(context, now, "todo");
}

export async function readNotificationFeed(
  context: OnboardingContext,
  now: Date,
): Promise<NotificationFeed> {
  const [items, unread, todo] = await Promise.all([
    readNotifications(context, { limit: 20, now }),
    countUnread(context, now),
    countTodo(context, now),
  ]);
  return { items, unread, todo };
}
