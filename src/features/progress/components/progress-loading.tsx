"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { PeriodNav } from "@/features/progress/components/period-nav";
import { RecordsFilters } from "@/features/progress/components/records-sections";
import { parsePeriod } from "@/features/progress/period";
import { parseRecordFilter } from "@/features/progress/records-view";

function Lede() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-200 flex-col gap-2.5 sm:w-auto sm:flex-1 sm:gap-3"
    >
      <Skeleton className="h-7 w-3/4 sm:h-12" />
      <Skeleton className="h-10 w-full sm:h-12" />
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-base font-semibold sm:text-xl">{children}</h2>;
}

function Rows({ count, className }: { count: number; className: string }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: count }, (_, item) => (
        <div
          key={item}
          className="flex items-center justify-between gap-4 border-t border-border py-3.5"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className={className} />
        </div>
      ))}
    </div>
  );
}

export function FitnessLoading() {
  const period = parsePeriod(useSearchParams().get("period"));
  return (
    <LoadingScope
      label="Chargement de la forme"
      className="flex flex-col gap-6.5 sm:gap-13"
    >
      <section className="flex flex-col gap-6.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
        <Lede />
        <PeriodNav period={period} />
      </section>
      <section className="flex flex-col gap-3 sm:gap-3.5">
        <SectionTitle>Condition, fatigue et fraîcheur</SectionTitle>
        <Skeleton
          aria-hidden="true"
          className="aspect-[350/168] w-full rounded-card sm:aspect-[1200/244]"
        />
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-full" />
        </div>
      </section>
      <div className="flex flex-wrap items-start gap-x-14 gap-y-9">
        <section className="flex min-w-0 flex-[999_1_620px] flex-col gap-3.5">
          <SectionTitle>Ce qui évolue</SectionTitle>
          <Rows count={5} className="h-8 w-24" />
        </section>
        <div
          aria-hidden="true"
          className="flex min-w-0 flex-[1_1_360px] flex-col gap-9"
        >
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </LoadingScope>
  );
}

export function RecoveryLoading() {
  return (
    <LoadingScope
      label="Chargement de la récupération"
      className="flex flex-col gap-6.5 sm:gap-13"
    >
      <section className="flex max-w-205 flex-col gap-2.5 sm:gap-3">
        <Lede />
      </section>
      <div
        aria-hidden="true"
        className="flex flex-col gap-4.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-12"
      >
        <Skeleton className="h-13 w-28 sm:h-24 sm:w-50" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full rounded-card" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-x-10 gap-y-9"
      >
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-28 w-full rounded-card" />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="flex flex-wrap items-start gap-x-14 gap-y-9"
      >
        <Skeleton className="h-72 min-w-0 flex-[1_1_420px] rounded-panel" />
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
        </div>
      </div>
    </LoadingScope>
  );
}

export function RecordsLoading() {
  const filter = parseRecordFilter(useSearchParams().get("filter"));
  return (
    <LoadingScope
      label="Chargement des records"
      className="flex min-w-0 flex-col gap-6 sm:gap-8"
    >
      <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <h1 className="text-[25px] leading-tight font-semibold tracking-tight max-sm:sr-only sm:text-[46px]">
          Records
        </h1>
        <div className="flex items-center gap-4 max-sm:w-full">
          <Skeleton aria-hidden="true" className="h-3 w-36 max-lg:hidden" />
          <RecordsFilters filter={filter} />
        </div>
      </section>
      <Skeleton
        aria-hidden="true"
        className="h-80 w-full rounded-panel sm:h-60 lg:h-48"
      />
      <Skeleton aria-hidden="true" className="h-72 w-full rounded-panel" />
      <div aria-hidden="true" className="flex flex-col gap-3.5">
        <Skeleton className="h-6 w-48" />
        <Rows count={6} className="h-6 w-20" />
      </div>
    </LoadingScope>
  );
}
