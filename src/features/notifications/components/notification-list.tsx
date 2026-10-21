"use client";

import { CheckIcon, RefreshCwIcon, WatchIcon } from "lucide-react";
import type { ComponentType } from "react";
import {
  NavActivitiesIcon,
  NavGearIcon,
  NavPlanIcon,
} from "@/components/stride/nav-icons";
import { MonoLabel } from "@/components/stride/mono-label";
import { StaffPortrait } from "@/features/coach/components/staff-portrait";
import { useStaff } from "@/features/coach/components/staff-context";
import { openNotification } from "@/server/notifications/actions";
import { cn } from "@/lib/utils";
import {
  groupByDay,
  notificationView,
  type Notification,
  type NotificationFamily,
  type NotificationStatus,
  type NotificationView,
} from "../model";

const familyIcons: Record<
  Exclude<NotificationFamily, "staff">,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  plan: {
    icon: NavPlanIcon,
    className: "border-accent/30 bg-accent/14 text-accent",
  },
  activity: {
    icon: NavActivitiesIcon,
    className: "border-provider/30 bg-provider/14 text-provider",
  },
  sync: {
    icon: RefreshCwIcon,
    className: "border-danger/30 bg-danger/14 text-danger",
  },
  watch: {
    icon: WatchIcon,
    className: "border-muted/30 bg-muted/14 text-muted",
  },
  shoe: {
    icon: NavGearIcon,
    className: "border-warning/30 bg-warning/14 text-warning",
  },
};

function NotificationIcon({ view }: { view: NotificationView }) {
  if (view.agent)
    return (
      <StaffPortrait agent={view.agent} size={32} className="rounded-surface" />
    );
  const { icon: Icon, className } =
    familyIcons[view.family === "staff" ? "plan" : view.family];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 place-items-center rounded-surface border",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function StatusMark({ status }: { status: NotificationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        status.tone === "warning" && "text-warning",
        status.tone === "success" && "text-success",
        status.tone === "muted" && "text-muted-foreground",
      )}
    >
      {status.tone === "success" ? (
        <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            status.tone === "warning" ? "bg-warning" : "bg-dim",
          )}
        />
      )}
      {status.label}
    </span>
  );
}

function NotificationRow({ view }: { view: NotificationView }) {
  return (
    <li
      className={cn(
        "border-t border-border-subtle first:border-t-0",
        view.unread && "bg-surface",
      )}
    >
      <form
        action={openNotification}
        className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-3.5 py-3 hover:bg-surface-raised/50"
      >
        <input type="hidden" name="id" value={view.id} />
        <NotificationIcon view={view} />
        <button
          type="submit"
          className="flex min-w-0 flex-col gap-0.75 rounded-control text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            className={cn(
              "text-sm leading-[1.35]",
              view.unread
                ? "font-semibold text-foreground"
                : "font-medium text-muted",
            )}
          >
            {view.title}
          </span>
          {view.body && (
            <span className="line-clamp-3 text-[12.5px] leading-[1.45] text-muted-foreground">
              {view.body}
            </span>
          )}
        </button>
        <MonoLabel
          size="micro"
          className="flex items-center gap-1.5 pt-0.75 whitespace-nowrap"
        >
          <time dateTime={view.occurredAt}>{view.time}</time>
          {view.unread && (
            <span className="size-2 shrink-0 rounded-full bg-accent">
              <span className="sr-only">Non lue</span>
            </span>
          )}
        </MonoLabel>
        {(view.action || view.status) && (
          <span className="col-span-2 col-start-2 flex flex-wrap items-center gap-2.5 pt-1.5">
            {view.action && (
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-surface border border-border-strong px-3 text-[12.5px] whitespace-nowrap text-foreground hover:border-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-8"
              >
                {view.action}
              </button>
            )}
            {view.status && <StatusMark status={view.status} />}
          </span>
        )}
      </form>
    </li>
  );
}

export function NotificationList({
  notifications,
  now,
  withDate = false,
}: {
  notifications: readonly Notification[];
  now: string;
  withDate?: boolean;
}) {
  const staff = useStaff();
  const days = groupByDay(
    notifications.map((notification) => notificationView(notification, staff)),
    new Date(now),
    { withDate },
  );
  return (
    <div>
      {days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h3 className="px-3.5 pt-3.5 pb-2 font-mono text-micro font-normal text-muted-foreground uppercase">
            {day.label}
          </h3>
          <ul className="border-t border-border-subtle">
            {day.items.map((view) => (
              <NotificationRow key={view.id} view={view} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
