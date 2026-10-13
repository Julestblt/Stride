import { DataCategoryScope } from "@/features/data-activity/components/status";
import {
  activitiesQuery,
  formatActivityDate,
  type Activity,
  type ActivityFilter,
} from "@/features/activities/activities";
import type { ActivityDetailData } from "../detail";
import type { ActivityView } from "../activity-view";
import { ActivityDetail } from "./activity-detail";
import { ActivityListPane } from "./activity-list-pane";
import { ActivitySplitFrame, ActivityToolbar } from "./activity-frame";

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
        <ActivityListPane
          activities={activities}
          total={total}
          filter={filter}
          limit={limit}
          search={search}
          today={today}
          selectedId={selected?.id ?? null}
          current={current}
        />
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
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
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
