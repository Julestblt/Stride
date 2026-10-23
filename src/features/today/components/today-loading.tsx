"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MonoLabel } from "@/components/stride/mono-label";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { localToday } from "@/features/app-shell/shell";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { formatTodayDate } from "@/features/today/today";
import { cn } from "@/lib/utils";

const card =
  "flex min-w-0 flex-col gap-3.5 rounded-card border border-border bg-surface px-5 py-5 sm:px-5.5";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <MonoLabel size="nano" className="text-[9.5px]">
      {children}
    </MonoLabel>
  );
}

export function TodayLoading() {
  const date = formatTodayDate(localToday(new Date()));
  return (
    <>
      <AppHeader title="Aujourd’hui" detail={date} />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-310 flex-col px-4 pt-3 pb-18 sm:px-[clamp(20px,3vw,40px)] md:pt-7">
          <LoadingScope
            label="Chargement de la journée"
            className="flex flex-col gap-4.5"
          >
            <Skeleton aria-hidden="true" className="h-5 w-64 max-w-full" />
            <div className="flex flex-col gap-4.5 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] xl:items-start">
              <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4.5">
                <section className={cn(card, "gap-4.5 sm:px-6.5 sm:py-6")}>
                  <div className="flex items-center gap-2.5">
                    <MonoLabel
                      size="nano"
                      tone="accent"
                      className="text-[9.5px]"
                    >
                      Séance du jour
                    </MonoLabel>
                    <Eyebrow>· {date}</Eyebrow>
                  </div>
                  <div aria-hidden="true" className="flex flex-col gap-4.5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-11 rounded-card" />
                      <Skeleton className="h-6 w-1/2" />
                    </div>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full rounded-surface" />
                  </div>
                </section>
                <section className={cn(card, "max-xl:order-3")}>
                  <Skeleton aria-hidden="true" className="h-3 w-40" />
                  <div aria-hidden="true" className="flex gap-1">
                    {Array.from({ length: 7 }, (_, day) => (
                      <Skeleton key={day} className="h-16 flex-1" />
                    ))}
                  </div>
                  <Skeleton aria-hidden="true" className="h-5 w-2/3" />
                </section>
              </div>
              <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4.5">
                <section className={cn(card, "max-xl:order-2")}>
                  <Eyebrow>Forme du jour</Eyebrow>
                  <div aria-hidden="true" className="flex flex-col gap-3.5">
                    <div className="flex items-end gap-3">
                      <Skeleton className="h-11 w-16" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex flex-col">
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          className="flex items-center gap-2.5 border-t border-border py-2.5"
                        >
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                    <Skeleton className="h-11 w-full rounded-surface" />
                  </div>
                </section>
                <section className={cn(card, "gap-2.5 max-xl:order-5")}>
                  <Eyebrow>Dernière activité</Eyebrow>
                  <div aria-hidden="true" className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-control" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                </section>
                <section className={cn(card, "gap-1.5 max-xl:order-4")}>
                  <Eyebrow>À venir</Eyebrow>
                  <div aria-hidden="true" className="mt-1.5 flex flex-col">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="flex items-center gap-3 border-t border-border py-2.5"
                      >
                        <Skeleton className="size-7 rounded-control" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </LoadingScope>
        </main>
      </div>
    </>
  );
}
