import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { cn } from "@/lib/utils";
import {
  bodyHref,
  healthViewLabels,
  healthViews,
  type HealthView,
} from "../health";

export function ScaleSwitch({ current }: { current: HealthView }) {
  return (
    <nav
      aria-label="Échelle"
      className="flex w-fit gap-0.5 rounded-surface border border-border bg-surface p-0.75 max-sm:w-full"
    >
      {healthViews.map((view) => (
        <Link
          key={view}
          href={bodyHref(view)}
          aria-current={view === current ? "page" : undefined}
          scroll={false}
          className={cn(
            "flex min-h-9 items-center justify-center rounded-control px-3.5 text-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10 max-sm:flex-1",
            view === current &&
              "bg-surface-raised font-semibold text-foreground",
          )}
        >
          {healthViewLabels[view]}
        </Link>
      ))}
    </nav>
  );
}
