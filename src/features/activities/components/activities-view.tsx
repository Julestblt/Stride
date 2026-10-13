import {
  DataActivityStatus,
  DataCategoryScope,
} from "@/features/data-activity/components/status";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SourceMark } from "@/components/stride/marks";
import {
  activitiesQuery,
  formatActivityDate,
  groupActivities,
  type Activity,
  type ActivityFilter,
} from "@/features/activities/activities";
import type { ActivityDetailData } from "../detail";
import type { ActivityView } from "../activity-view";
import { ActivitySearch } from "./activity-search";
import { ActivityDetail } from "./activity-detail";
import {
  ActivityFilters,
  ActivityList,
  ActivityListFooter,
} from "./activity-list";
import { ListScrollRegion } from "./list-scroll-region";

export function ActivitiesView({
  activities,
  total,
  filter,
  limit,
  selected,
  view,
  search,
  current,
  today,
}: {
  activities: Activity[];
  total: number;
  filter: ActivityFilter;
  limit: number;
  selected: ActivityDetailData | null;
  view: ActivityView | null;
  search: string;
  current: boolean;
  sync: string | null;
  today: string;
}) {
  const ListHeading = current ? "h2" : "h1";
  return (
    <div className="flex min-h-0 flex-1">
      <div
        className={cn(
          "min-h-0 w-full flex-col bg-surface-inset lg:flex lg:w-80 lg:shrink-0 lg:border-r lg:border-border-subtle",
          current ? "hidden" : "flex",
        )}
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-border-subtle px-5 pt-5 pb-3 lg:px-3.5 lg:pt-3.5 lg:pb-2.5">
          <div className="flex items-center gap-2">
            <SidebarTrigger
              aria-label="Afficher ou masquer la barre latérale"
              className="-ml-2 lg:hidden"
            />
            <ListHeading className="flex-1 text-headline font-semibold lg:text-base">
              Activités
            </ListHeading>
            <DataActivityStatus />
          </div>
          <ActivitySearch filter={filter} search={search} />
          <ActivityFilters filter={filter} search={search} />
        </div>
        <DataCategoryScope
          categories={["activities"]}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ListScrollRegion
            storageKey={`stride:activities:list:${filter}:${search}`}
            label="Liste des activités"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <ActivityList
              groups={groupActivities(activities, today)}
              filter={filter}
              limit={limit}
              search={search}
              selectedId={selected?.id ?? null}
              current={current}
              today={today}
            />
            {activities.length > 0 && (
              <>
                <ActivityListFooter
                  filter={filter}
                  limit={limit}
                  search={search}
                  shown={activities.length}
                  total={total}
                />
                <p className="flex items-center gap-1.75 px-5 pb-4 text-xs text-muted-foreground lg:px-3.5">
                  <SourceMark source="provider" />
                  Tout vient de Garmin
                </p>
              </>
            )}
          </ListScrollRegion>
        </DataCategoryScope>
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col lg:flex",
          current ? "flex" : "hidden",
        )}
      >
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
          <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-center"
          />
          <nav
            aria-label="Fil d’Ariane"
            className="flex min-w-0 items-center gap-2 text-sm"
          >
            <Link
              href={`/activities${activitiesQuery(filter, limit, search)}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Activités
            </Link>
            {selected && (
              <>
                <span aria-hidden="true" className="text-dim">
                  /
                </span>
                <span
                  aria-current={current ? "page" : undefined}
                  className="truncate"
                >
                  {formatActivityDate(selected.date, today)}
                </span>
              </>
            )}
          </nav>
          <DataActivityStatus className="ml-auto md:hidden" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <DataCategoryScope categories={["activities"]}>
            {selected ? (
              <ActivityDetail
                activity={selected}
                view={view}
                current={current}
                detailHref={`/activities/${selected.id}/details${activitiesQuery(filter, limit, search)}`}
              />
            ) : (
              <p className="px-5 pt-8 text-body text-muted sm:px-10">
                {search
                  ? "Aucune activité ne correspond à ce nom."
                  : "Les activités importées depuis Garmin apparaîtront ici."}
              </p>
            )}
          </DataCategoryScope>
        </div>
      </div>
    </div>
  );
}
