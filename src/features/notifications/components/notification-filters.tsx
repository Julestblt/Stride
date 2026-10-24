import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { cn } from "@/lib/utils";
import {
  filterHref,
  filterLabels,
  notificationFilters,
  type NotificationFilter,
} from "../model";

const chip =
  "flex min-h-11 shrink-0 items-center rounded-full border px-3 text-[13px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-8";
const selected =
  "border-foreground bg-foreground font-semibold text-background";
const idle = "border-border text-muted-foreground hover:text-foreground";

function label(filter: NotificationFilter, todo: number) {
  return filter === "todo" && todo > 0
    ? `${filterLabels[filter]} · ${todo}`
    : filterLabels[filter];
}

export function NotificationFilters({
  current,
  todo,
  onSelect,
  className,
}: {
  current: NotificationFilter;
  todo: number;
  onSelect?: (filter: NotificationFilter) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrer les notifications"
      className={cn(
        "flex [scrollbar-width:none] gap-1.5 overflow-x-auto",
        className,
      )}
    >
      {notificationFilters.map((filter) =>
        onSelect ? (
          <button
            key={filter}
            type="button"
            aria-pressed={filter === current}
            onClick={() => onSelect(filter)}
            className={cn(chip, filter === current ? selected : idle)}
          >
            {label(filter, todo)}
          </button>
        ) : (
          <Link
            key={filter}
            href={filterHref(filter)}
            aria-current={filter === current ? "page" : undefined}
            className={cn(chip, filter === current ? selected : idle)}
          >
            {label(filter, todo)}
          </Link>
        ),
      )}
    </div>
  );
}
