"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { localToday } from "@/features/app-shell/shell";
import { parseHealthView } from "@/features/progress/health";
import { HealthViewSwitch } from "@/features/progress/components/health-sections";
import { parseRacesView } from "@/features/races/overview";
import { RacesTitle } from "@/features/races/components/races-title";
import { MonoLabel } from "@/components/stride/mono-label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActivityListHeader,
  ActivitySplitFrame,
  ActivityToolbar,
} from "@/features/activities/components/activity-frame";
import {
  activitiesQuery,
  parseActivityFilter,
  parseActivityLimit,
  parseActivitySearch,
} from "@/features/activities/activities";
import { ActivityListPane } from "@/features/activities/components/activity-list-pane";
import { useActivityListSnapshot } from "@/features/activities/components/activity-list-snapshot";
import { useDataActivity } from "./provider";

export function LoadingScope({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const markSkeleton = useDataActivity()?.markSkeleton;
  useEffect(() => markSkeleton?.(), [markSkeleton]);
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function ActivityRowsLoading() {
  return (
    <div
      aria-hidden="true"
      className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain"
    >
      <div className="border-b border-border-subtle px-5 pt-2.5 pb-1 lg:px-3.5">
        <Skeleton className="h-3 w-20" />
      </div>
      {Array.from({ length: 12 }, (_, item) => (
        <div
          key={item}
          className="flex flex-col gap-1.5 border-b border-border-subtle px-5 py-3 lg:px-3.5"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-36 lg:h-4" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityContentLoading({ full = false }: { full?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain"
    >
      <article
        className={
          full
            ? "mx-auto flex w-full max-w-360 flex-col gap-10 px-5 pt-8 pb-12 sm:px-[4vw]"
            : "flex w-full max-w-240 flex-col gap-8 px-5 pt-8 pb-12 lg:px-10 2xl:mx-auto 2xl:max-w-360"
        }
      >
        <div
          className={
            full
              ? "flex flex-col gap-3"
              : "flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"
          }
        >
          {full && <Skeleton className="h-3 w-48" />}
          <div
            className={
              full
                ? "flex flex-wrap items-end justify-between gap-x-8 gap-y-5"
                : "contents"
            }
          >
            <Skeleton
              className={
                full ? "h-8 w-72 max-w-full sm:h-13" : "h-10 w-56 max-w-full"
              }
            />
            <div className="flex flex-wrap gap-x-5 gap-y-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex flex-col gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <section className="flex flex-col gap-2.5">
          <MonoLabel>Parcours</MonoLabel>
          <div className="overflow-hidden rounded-card border border-border bg-surface-inset">
            <Skeleton
              className={
                full
                  ? "h-95 w-full rounded-none"
                  : "h-64 w-full rounded-none lg:h-90"
              }
            />
            <div className="border-t border-border px-3.5 pt-2.5 pb-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-16 w-full" />
            </div>
          </div>
        </section>
        <div
          className={
            full
              ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]"
              : "flex flex-col gap-8"
          }
        >
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </article>
    </div>
  );
}

export function ActivitiesLoading({ current = false }: { current?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const queryValue = (key: string) => {
    const values = params.getAll(key);
    return values.length === 1 ? values[0] : undefined;
  };
  const filter = parseActivityFilter(queryValue("filter"));
  const limit = parseActivityLimit(queryValue("limit"));
  const search = parseActivitySearch(queryValue("q"));
  const snapshot = useActivityListSnapshot({ filter, limit, search });
  const selectedId = pathname.split("/")[2] ?? null;

  return (
    <LoadingScope
      label={current ? "Chargement de l’activité" : "Chargement des activités"}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ActivitySplitFrame
        current={current}
        list={
          current && snapshot ? (
            <ActivityListPane
              {...snapshot}
              selectedId={selectedId}
              current
              registerSnapshot={false}
            />
          ) : (
            <>
              <ActivityListHeader current={current} loading />
              <ActivityRowsLoading />
            </>
          )
        }
      >
        <ActivityToolbar
          href={`/activities${activitiesQuery(filter, limit, search)}`}
        />
        <ActivityContentLoading />
      </ActivitySplitFrame>
    </LoadingScope>
  );
}

export function ActivityFullDetailLoading() {
  return (
    <LoadingScope
      label="Chargement du détail de l’activité"
      className="flex min-h-0 flex-1 flex-col"
    >
      <ActivityToolbar>
        <span aria-hidden="true" className="text-dim">
          /
        </span>
        <span aria-current="page">Détail</span>
      </ActivityToolbar>
      <ActivityContentLoading full />
    </LoadingScope>
  );
}

const healthHeaderDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function HealthLoading() {
  const query = useSearchParams();
  const view = parseHealthView(query.get("view"));
  const today = localToday(new Date());
  return (
    <LoadingScope
      label="Chargement de la santé"
      className="flex flex-col gap-6 sm:gap-8"
    >
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
          Santé
        </h1>
        <HealthViewSwitch
          current={view}
          date={healthHeaderDate.format(new Date(`${today}T00:00:00Z`))}
        />
      </section>
      <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 rounded-panel" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-panel" />
      <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
      </div>
    </LoadingScope>
  );
}

export function RaceLoading() {
  return (
    <LoadingScope
      label="Chargement des courses"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-44 w-full rounded-panel" />
      <div aria-hidden="true" className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
      </div>
    </LoadingScope>
  );
}

export function RacesLoading() {
  const view = parseRacesView(useSearchParams().get("view"));
  return (
    <LoadingScope
      label="Chargement des courses"
      className="flex flex-col gap-7 sm:gap-9"
    >
      <RacesTitle
        view={view}
        subtitle={<Skeleton className="h-6 w-56 max-w-full" />}
      />
      <div aria-hidden="true" className="flex flex-col gap-7 sm:gap-9">
        {view !== "past" && (
          <>
            <Skeleton className="h-36 w-full rounded-panel" />
            <Skeleton className="h-105 w-full rounded-panel lg:h-100" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-22 w-full rounded-card" />
              <Skeleton className="h-22 w-full rounded-card" />
            </div>
          </>
        )}
        {view !== "upcoming" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-44" />
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-14 w-full" />
            ))}
          </div>
        )}
      </div>
    </LoadingScope>
  );
}
