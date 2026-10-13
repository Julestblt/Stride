import { cn } from "@/lib/utils";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  racesViewHref,
  racesViewLabels,
  racesViews,
  type RacesView,
} from "../overview";

export function RacesTitle({
  view,
  counts,
  subtitle,
}: {
  view: RacesView;
  counts?: { upcoming: number; past: number };
  subtitle?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
          Courses
        </h1>
        {subtitle && <div className="text-body text-muted">{subtitle}</div>}
      </div>
      <nav
        aria-label="Filtre des courses"
        className="flex gap-0.5 rounded-surface border border-border bg-surface p-0.75 max-sm:w-full"
      >
        {racesViews.map((item) => (
          <Link
            key={item}
            href={racesViewHref(item)}
            aria-current={item === view ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1.5 rounded-control px-3 text-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10 max-sm:flex-1",
              item === view && "bg-border font-semibold text-foreground",
            )}
          >
            {racesViewLabels[item]}
            {item !== "all" && counts && (
              <span className="font-normal text-muted-foreground">
                {counts[item]}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </section>
  );
}
