import Link from "next/link";
import { cn } from "@/lib/utils";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  activityFilterLabels,
  activityFilters,
  activityTitle,
  formatActivityDate,
  listMetrics,
  type ActivityFilter,
  type ActivityGroup,
} from "@/features/activities/activities";

function filterQuery(filter: ActivityFilter) {
  return filter === "all" ? "" : `?filter=${filter}`;
}

export function activityHref(id: string, filter: ActivityFilter) {
  return `/activities/${id}${filterQuery(filter)}`;
}

export function ActivityFilters({ filter }: { filter: ActivityFilter }) {
  return (
    <nav aria-label="Filtrer les activités" className="flex gap-1">
      {activityFilters.map((item) => (
        <Link
          key={item}
          href={`/activities${filterQuery(item)}`}
          aria-current={item === filter ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-surface border px-3.5 text-sm transition-colors duration-150 ease-stride lg:min-h-7 lg:rounded-control lg:px-2.5 lg:text-xs",
            item === filter
              ? "border-border-strong bg-surface-raised text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {activityFilterLabels[item]}
        </Link>
      ))}
    </nav>
  );
}

export function ActivityList({
  groups,
  filter,
  selectedId,
  current,
  today,
}: {
  groups: ActivityGroup[];
  filter: ActivityFilter;
  selectedId: string | null;
  current: boolean;
  today: string;
}) {
  if (groups.length === 0)
    return (
      <p className="px-5 py-6 text-meta text-muted lg:px-3.5">
        {filter === "all"
          ? "Aucune activité importée pour l’instant."
          : `Aucune sortie ${activityFilterLabels[filter].toLowerCase()} importée pour l’instant.`}
      </p>
    );
  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <MonoLabel
            size="nano"
            asChild
            className="block px-5 pt-2.5 pb-1 lg:px-3.5"
          >
            <h2>{group.label}</h2>
          </MonoLabel>
          <ul>
            {group.activities.map((activity) => {
              const selected = activity.id === selectedId;
              return (
                <li key={activity.id}>
                  <Link
                    href={activityHref(activity.id, filter)}
                    aria-current={selected && current ? "true" : undefined}
                    className={cn(
                      "flex flex-col gap-1.5 border-b border-border-subtle px-5 py-3 transition-colors duration-150 ease-stride hover:bg-surface lg:px-3.5",
                      selected &&
                        (current
                          ? "bg-surface-raised shadow-[inset_2px_0_0_var(--color-accent)]"
                          : "lg:bg-surface-raised lg:shadow-[inset_2px_0_0_var(--color-accent)]"),
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={cn(
                          "min-w-0 truncate text-sm text-foreground",
                          selected ? "font-semibold" : "font-medium",
                        )}
                      >
                        {activityTitle(activity)}
                      </span>
                      <MonoLabel
                        size="nano"
                        asChild
                        tone={selected && current ? "foreground" : "muted"}
                        className="shrink-0"
                      >
                        <time dateTime={activity.date}>
                          {formatActivityDate(activity.date, today)}
                        </time>
                      </MonoLabel>
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
                      {listMetrics(activity).map((metric) => (
                        <Metric
                          key={metric.key}
                          size="sm"
                          className="text-body"
                          value={metric.value}
                          unit={metric.unit}
                          aria-label={`${metric.label} ${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`}
                        />
                      ))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
