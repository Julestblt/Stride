import { Skeleton } from "@/components/ui/skeleton";
import { PlanFrame } from "../_components/plan-frame";

export default function Loading() {
  return (
    <PlanFrame crumbs={[{ label: "Plan" }]}>
      <div
        role="status"
        aria-label="Chargement du plan"
        className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]"
      >
        <div aria-hidden="true" className="flex flex-col gap-2 max-lg:hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
        <div aria-hidden="true" className="flex flex-col gap-8">
          <Skeleton className="h-14 w-full rounded-card" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <Skeleton className="h-40 w-full max-sm:hidden" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    </PlanFrame>
  );
}
