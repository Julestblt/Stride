import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScope } from "@/features/data-activity/components/loading";

export function NutritionLoading() {
  return (
    <LoadingScope
      label="Chargement de la nutrition"
      className="flex flex-col gap-6.5 sm:gap-12"
    >
      <section
        aria-hidden="true"
        className="flex max-w-205 flex-col gap-2.5 sm:gap-3"
      >
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-3/4 sm:h-12" />
        <Skeleton className="h-10 w-full sm:h-12" />
        <div className="flex gap-2.5 pt-1.5 max-sm:hidden">
          <Skeleton className="h-9 w-40 rounded-surface" />
        </div>
      </section>
      <section
        aria-hidden="true"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] sm:gap-8 sm:border-y sm:border-border sm:py-7"
      >
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex flex-col gap-1.5 rounded-panel border border-border bg-surface-raised p-3.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24 sm:h-12" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </section>
      <section
        aria-hidden="true"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-x-10 gap-y-6.5"
      >
        {[0, 1].map((item) => (
          <div key={item} className="flex flex-col gap-2 sm:gap-2.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </section>
      <section aria-hidden="true" className="flex flex-col gap-3.5">
        <Skeleton className="h-5 w-48" />
        <div className="flex flex-col">
          {Array.from({ length: 6 }, (_, item) => (
            <div key={item} className="border-t border-border py-3">
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </section>
    </LoadingScope>
  );
}
