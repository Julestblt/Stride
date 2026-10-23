import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { PlanFrame } from "../_components/plan-frame";

export default function Loading() {
  return (
    <PlanFrame
      crumbs={[{ label: "Plan", href: "/plan" }, { label: "Historique" }]}
      back={{ href: "/plan", label: "Retour au plan" }}
      className="max-w-260 gap-5 sm:gap-5 sm:pt-7"
    >
      <LoadingScope
        label="Chargement de l’historique du plan"
        className="flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[30px]">
              Historique du plan
            </h1>
            <Skeleton aria-hidden="true" className="h-4 w-56" />
          </div>
          <div
            aria-hidden="true"
            className="flex gap-1.5 overflow-hidden sm:ml-auto"
          >
            {["w-16", "w-24", "w-24", "w-20"].map((width, index) => (
              <Skeleton
                key={index}
                className={`h-9 shrink-0 rounded-full ${width}`}
              />
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-2.5 sm:gap-1.5">
          <Skeleton className="mt-2.5 mb-0.5 h-3 w-24 sm:mt-3.5 sm:mb-1" />
          {Array.from({ length: 5 }, (_, item) => (
            <Skeleton key={item} className="h-20 w-full rounded-card" />
          ))}
        </div>
      </LoadingScope>
    </PlanFrame>
  );
}
