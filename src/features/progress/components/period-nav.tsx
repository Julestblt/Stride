import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  defaultPeriod,
  periodLabels,
  progressPeriods,
  type ProgressPeriod,
} from "@/features/progress/period";
import { cn } from "@/lib/utils";

export function PeriodNav({ period }: { period: ProgressPeriod }) {
  return (
    <nav
      aria-label="Période"
      className="flex overflow-hidden rounded-surface border border-border"
    >
      {progressPeriods.map((item) => (
        <Link
          key={item}
          href={
            item === defaultPeriod ? "/progress" : `/progress?period=${item}`
          }
          aria-current={item === period ? "page" : undefined}
          scroll={false}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center border-l border-border px-3.5 text-meta whitespace-nowrap text-muted-foreground transition-colors first:border-l-0 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:min-h-9 sm:flex-none",
            item === period && "bg-surface-raised text-foreground",
          )}
        >
          {periodLabels[item]}
        </Link>
      ))}
    </nav>
  );
}
