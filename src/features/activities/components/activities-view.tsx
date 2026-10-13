import { DataCategoryScope } from "@/features/data-activity/components/status";
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
import { ActivityDetail } from "./activity-detail";
import { ActivityList, ActivityListFooter } from "./activity-list";
import {
  ActivitySplitFrame,
  ActivityListHeader,
  ActivityToolbar,
} from "./activity-frame";
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
  return (
    <ActivitySplitFrame
      current={current}
      list={
        <>
          <ActivityListHeader
            current={current}
            filter={filter}
            search={search}
          />
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
        </>
      }
    >
      <ActivityToolbar
        href={`/activities${activitiesQuery(filter, limit, search)}`}
      >
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
      </ActivityToolbar>
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
    </ActivitySplitFrame>
  );
}
