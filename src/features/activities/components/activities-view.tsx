import { DataCategoryScope } from "@/features/data-activity/components/status";
import {
  activitiesQuery,
  formatActivityDate,
  type Activity,
  type ActivityFilter,
} from "@/features/activities/activities";
import { ActivityListPane } from "./activity-list-pane";
import { ActivitySplitFrame, ActivityToolbar } from "./activity-frame";

export function ActivitiesView({
  activities,
  total,
  filter,
  limit,
  selected,
  search,
  current,
  today,
  children,
}: {
  activities: Activity[];
  total: number;
  filter: ActivityFilter;
  limit: number;
  selected: Pick<Activity, "id" | "date"> | null;
  search: string;
  current: boolean;
  today: string;
  children: React.ReactNode;
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
            children
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
