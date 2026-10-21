import type { Metadata } from "next";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { MarkAllRead } from "@/features/notifications/components/mark-all-read";
import { NotificationEmpty } from "@/features/notifications/components/notification-empty";
import { NotificationFilters } from "@/features/notifications/components/notification-filters";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { parseFilter, unreadLabel } from "@/features/notifications/model";
import { requireAthlete } from "@/server/app/session";
import {
  countTodo,
  countUnread,
  readNotifications,
} from "@/server/notifications/feed";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const filter = parseFilter(query.filtre);
  const now = new Date();
  const [notifications, unread, todo] = await Promise.all([
    readNotifications(context, { filter, now }),
    countUnread(context, now),
    countTodo(context, now),
  ]);
  return (
    <>
      <AppHeader title="Notifications" />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-205 flex-col gap-3 pt-2 pb-18 md:gap-4.5 md:px-[clamp(20px,3vw,40px)] md:pt-7">
          <div className="flex flex-wrap items-center gap-3 px-4 md:items-end md:px-0">
            <div className="flex flex-col gap-1 max-md:sr-only">
              <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">
                Notifications
              </h1>
              <p className="text-meta text-muted-foreground">
                Ce que le staff, Garmin et ton plan ont fait pendant que tu
                courais. 30 derniers jours.
              </p>
            </div>
            {unread > 0 && (
              <>
                <span className="text-xs text-muted-foreground md:hidden">
                  {unreadLabel(unread)}
                </span>
                <MarkAllRead
                  label="Tout lire"
                  className="-mr-2.5 ml-auto min-h-11 md:hidden"
                />
                <MarkAllRead
                  size="md"
                  variant="outline"
                  className="ml-auto max-md:hidden"
                />
              </>
            )}
          </div>
          <NotificationFilters
            current={filter}
            todo={todo}
            className="px-4 md:px-0"
          />
          {notifications.length ? (
            <div className="overflow-hidden border-border md:rounded-card md:border md:bg-surface-panel">
              <NotificationList
                notifications={notifications}
                now={now.toISOString()}
                withDate
              />
            </div>
          ) : (
            <NotificationEmpty
              filtered={filter !== "toutes"}
              className="flex-1 pt-24"
            />
          )}
        </main>
      </div>
    </>
  );
}
