"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { parseFilter } from "@/features/notifications/model";
import { NotificationFilters } from "./notification-filters";

export function NotificationsLoading() {
  const filter = parseFilter(useSearchParams().get("filtre"));
  return (
    <>
      <AppHeader title="Notifications" />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-205 flex-col pt-2 pb-18 md:px-[clamp(20px,3vw,40px)] md:pt-7">
          <LoadingScope
            label="Chargement des notifications"
            className="flex flex-col gap-3 md:gap-4.5"
          >
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
            </div>
            <NotificationFilters
              current={filter}
              todo={0}
              className="px-4 md:px-0"
            />
            <div
              aria-hidden="true"
              className="overflow-hidden border-border md:rounded-card md:border md:bg-surface-panel"
            >
              {Array.from({ length: 6 }, (_, item) => (
                <div
                  key={item}
                  className="flex gap-3 border-b border-border-subtle px-4 py-3.5 last:border-b-0"
                >
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </LoadingScope>
        </main>
      </div>
    </>
  );
}
