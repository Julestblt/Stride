import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { PlanFrame } from "../_components/plan-frame";

export default function Loading() {
  return (
    <PlanFrame crumbs={[{ label: "Plan" }]}>
      <LoadingScope
        label="Chargement du plan"
        className="flex flex-col gap-7 sm:gap-9"
      >
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-11 w-3/4" />
          <Skeleton className="h-5 w-1/2 max-sm:hidden" />
        </div>
        <Skeleton
          aria-hidden="true"
          className="h-31 w-full rounded-card sm:h-17 sm:rounded-panel"
        />
        <Skeleton
          aria-hidden="true"
          className="h-36 w-full rounded-card sm:h-56 sm:rounded-panel"
        />
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </LoadingScope>
    </PlanFrame>
  );
}
