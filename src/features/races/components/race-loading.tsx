import { AppHeader } from "@/features/app-shell/components/app-header";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";

export function RaceEntryLoading() {
  return (
    <>
      <AppHeader
        title="Courses"
        back={{ href: "/races", label: "Retour aux courses" }}
        className="print:hidden"
        breadcrumb={
          <nav
            aria-label="Fil d’Ariane"
            className="flex min-w-0 flex-1 items-center gap-2 text-sm"
          >
            <Link
              href="/races"
              className="text-muted-foreground hover:text-foreground"
            >
              Courses
            </Link>
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
            <Skeleton aria-hidden="true" className="h-4 w-40" />
          </nav>
        }
      />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-360 flex-col px-5 pt-3 pb-18 sm:px-[clamp(20px,4vw,56px)] md:pt-9">
          <LoadingScope
            label="Chargement de la course"
            className="flex flex-col gap-6 sm:gap-7"
          >
            <div aria-hidden="true" className="flex flex-col gap-5 sm:gap-7">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-8.5 w-72 max-w-full sm:h-12" />
                <Skeleton className="h-12 w-40" />
              </div>
              <Skeleton className="h-34 w-full rounded-panel sm:h-24" />
            </div>
            <div
              aria-hidden="true"
              className="-mx-5 flex gap-6 border-b border-border px-5 sm:mx-0 sm:px-0"
            >
              {["w-16", "w-18", "w-20", "w-22", "w-24"].map((width) => (
                <div
                  key={width}
                  className="flex min-h-11 shrink-0 items-center"
                >
                  <Skeleton className={`h-4 ${width}`} />
                </div>
              ))}
            </div>
            <Skeleton
              aria-hidden="true"
              className="h-44 w-full rounded-panel"
            />
            <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
              <Skeleton className="h-64 rounded-panel" />
              <Skeleton className="h-64 rounded-panel" />
            </div>
          </LoadingScope>
        </main>
      </div>
    </>
  );
}
