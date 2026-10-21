"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  badgeValue,
  bellLabel,
  isTodo,
  matchesFilter,
  unreadLabel,
  type NotificationFilter,
} from "../model";
import { BellIcon } from "./bell-icon";
import { MarkAllRead } from "./mark-all-read";
import { NotificationEmpty } from "./notification-empty";
import { NotificationFilters } from "./notification-filters";
import { NotificationList } from "./notification-list";
import { useNotifications } from "./notifications-context";

const bell =
  "relative grid shrink-0 place-items-center rounded-control border border-border text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:border-border-strong aria-expanded:bg-surface-raised aria-expanded:text-foreground";

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.75 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1.25 text-[11px] font-semibold text-background ring-2 ring-surface-inset"
    >
      {badgeValue(count)}
    </span>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const { feed, now } = useNotifications();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const location = `${pathname}?${search}`;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === location;
  const setOpen = (value: boolean) => setOpenAt(value ? location : null);
  const [filter, setFilter] = useState<NotificationFilter>("toutes");
  const unread = feed?.unread ?? 0;
  const items = (feed?.items ?? []).filter((item) =>
    matchesFilter(item, filter),
  );
  const current = pathname === "/notifications";
  return (
    <>
      <Link
        href="/notifications"
        aria-label={bellLabel(unread)}
        aria-current={current ? "page" : undefined}
        className={cn(
          bell,
          "size-11 border-transparent md:hidden",
          current && "hidden",
          className,
        )}
      >
        <BellIcon className="size-4.5" />
        <Badge count={unread} />
      </Link>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={bellLabel(unread)}
          className={cn(bell, "size-8.5 max-md:hidden", className)}
        >
          <BellIcon className="size-4" />
          <Badge count={unread} />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          aria-label="Notifications"
          className="max-h-[min(760px,calc(100svh-80px))] w-105 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
            <h2 className="text-[15px] font-semibold">Notifications</h2>
            <span className="text-xs text-muted-foreground">
              {unreadLabel(unread)}
            </span>
            {unread > 0 && <MarkAllRead className="ml-auto" />}
          </div>
          <NotificationFilters
            current={filter}
            todo={(feed?.items ?? []).filter(isTodo).length}
            onSelect={setFilter}
            className="px-3.5 pb-2.5"
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-b border-border">
            {items.length ? (
              <NotificationList notifications={items} now={now} />
            ) : (
              <NotificationEmpty filtered={filter !== "toutes"} />
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-center gap-1.5 text-[13px] text-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            Voir tout l’historique
            <ChevronRightIcon aria-hidden="true" className="size-3" />
          </Link>
        </PopoverContent>
      </Popover>
    </>
  );
}
