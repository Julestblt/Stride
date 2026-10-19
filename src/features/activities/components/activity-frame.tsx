import type { ReactNode } from "react";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { DataActivityLink } from "@/features/data-activity/components/navigation";
import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  activityFilters,
  activityFilterLabels,
  type ActivityFilter,
} from "../activities";
import { ActivitySearch } from "./activity-search";
import { ActivityFilters } from "./activity-list";

export function ActivitySplitFrame({
  current,
  list,
  children,
}: {
  current: boolean;
  list: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <div
        className={cn(
          "min-h-0 w-full flex-col bg-surface-inset lg:flex lg:w-80 lg:shrink-0 lg:border-r lg:border-border-subtle",
          current ? "hidden" : "flex",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col lg:flex",
          current ? "flex" : "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ActivityListHeader({
  current,
  filter = "all",
  search = "",
  loading = false,
}: {
  current: boolean;
  filter?: ActivityFilter;
  search?: string;
  loading?: boolean;
}) {
  const Heading = current ? "h2" : "h1";
  return (
    <div className="relative flex shrink-0 flex-col gap-3 border-b border-border-subtle px-5 pt-5 pb-3 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
      <div className="flex items-center gap-2">
        <SidebarTrigger
          aria-label="Afficher ou masquer la barre latérale"
          className="-ml-2 max-md:hidden lg:hidden"
        />
        <Heading className="flex-1 text-headline font-semibold lg:text-base">
          Activités
        </Heading>
        <DataActivityStatus />
        <SidebarTrigger
          aria-label="Afficher ou masquer la barre latérale"
          className="-mr-2 size-11 md:hidden"
        />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-11 w-full rounded-surface lg:h-8" />
          <div aria-hidden="true" className="flex gap-1">
            {activityFilters.map((item) => (
              <span
                key={item}
                className="inline-flex min-h-11 items-center rounded-surface border border-border px-3.5 text-sm text-muted-foreground lg:min-h-7 lg:rounded-control lg:px-2.5 lg:text-xs"
              >
                {activityFilterLabels[item]}
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <ActivitySearch filter={filter} search={search} />
          <ActivityFilters filter={filter} search={search} />
        </>
      )}
      <DataActivityThread className="lg:hidden" />
    </div>
  );
}

export function ActivityToolbar({
  href = "/activities",
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <AppHeader
      title="Activités"
      back={{ href, label: "Retour aux activités" }}
      breadcrumb={
        <nav
          aria-label="Fil d’Ariane"
          className="flex min-w-0 items-center gap-2 text-sm"
        >
          <DataActivityLink
            href={href}
            className="text-muted-foreground hover:text-foreground"
          >
            Activités
          </DataActivityLink>
          {children}
        </nav>
      }
    />
  );
}
