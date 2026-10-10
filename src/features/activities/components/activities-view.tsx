import Link from "next/link";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PulseDot, SourceMark } from "@/components/stride/marks";
import {
  activitiesQuery,
  formatActivityDate,
  groupActivities,
  type Activity,
  type ActivityFilter,
} from "@/features/activities/activities";
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
  current,
  sync,
  today,
}: {
  activities: Activity[];
  total: number;
  filter: ActivityFilter;
  limit: number;
  selected: Activity | null;
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
            <SidebarTrigger className="-ml-2 lg:hidden" />
            <ListHeading className="flex-1 text-headline font-semibold lg:text-base">
              Activités
            </ListHeading>
            {sync && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PulseDot tone="success" breathing={false} />
                <span>
                  <span className="lg:hidden">Garmin </span>
                  <span className="lg:hidden">{sync.toLowerCase()}</span>
                  <span className="hidden lg:inline">{sync}</span>
                </span>
              </span>
            )}
          </div>
          <ActivityFilters filter={filter} />
        </div>
        <ListScrollRegion
          storageKey={`stride:activities:list:${filter}`}
          label="Liste des activités"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <ActivityList
            groups={groupActivities(activities, today)}
            filter={filter}
            limit={limit}
            selectedId={selected?.id ?? null}
            current={current}
            today={today}
          />
          {activities.length > 0 && (
            <>
              <ActivityListFooter
                filter={filter}
                limit={limit}
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
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col lg:flex",
          current ? "flex" : "hidden",
        )}
      >
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
          <SidebarTrigger />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-center"
          />
          <nav
            aria-label="Fil d’Ariane"
            className="flex min-w-0 items-center gap-2 text-sm"
          >
            <Link
              href={`/activities${activitiesQuery(filter, limit)}`}
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
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {selected ? (
            <ActivityDetail
              activity={selected}
              current={current}
              detailHref={`/activities/${selected.id}/details${activitiesQuery(filter, limit)}`}
            />
          ) : (
            <p className="px-5 pt-8 text-body text-muted sm:px-10">
              Les activités importées depuis Garmin apparaîtront ici.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
