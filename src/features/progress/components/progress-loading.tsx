"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { ScaleSwitch } from "@/features/progress/components/scale-switch";
import { PeriodNav } from "@/features/progress/components/period-nav";
import { parseHealthView } from "@/features/progress/health";
import { parsePeriod } from "@/features/progress/period";

function Lede() {
  return (
    <div aria-hidden="true" className="flex w-full flex-col gap-2.5 sm:gap-3.5">
      <Skeleton className="h-7 w-3/4 sm:h-10" />
      <Skeleton className="h-7 w-1/2 sm:h-10" />
      <Skeleton className="h-10 w-full sm:h-12" />
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-base font-semibold sm:text-lg">{children}</h2>;
}

function Rows({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col border-t border-border">
      {Array.from({ length: count }, (_, item) => (
        <div
          key={item}
          className="flex items-center justify-between gap-4 border-b border-border py-3.5"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

const twoColumns =
  "grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10";

export function FitnessLoading() {
  const period = parsePeriod(useSearchParams().get("period"));
  return (
    <LoadingScope
      label="Chargement de la forme"
      className="flex flex-col gap-8 sm:gap-10"
    >
      <section className="grid items-start gap-6.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-3.5 max-lg:order-2">
          <Lede />
          <PeriodNav period={period} />
        </div>
        <Skeleton
          aria-hidden="true"
          className="h-64 w-full rounded-card max-lg:order-1"
        />
      </section>
      <div className={twoColumns}>
        <section className="flex flex-col gap-3.5">
          <SectionTitle>Condition et fatigue</SectionTitle>
          <Skeleton
            aria-hidden="true"
            className="aspect-[350/168] w-full rounded-card sm:aspect-[1200/244]"
          />
          <Skeleton aria-hidden="true" className="h-16 w-full rounded-card" />
        </section>
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2.5">
            <SectionTitle>Prévisions de course</SectionTitle>
            <Rows count={3} />
          </section>
          <section className="flex flex-col gap-2.5">
            <SectionTitle>Répartition de l’intensité</SectionTitle>
            <Skeleton aria-hidden="true" className="h-24 w-full rounded-card" />
          </section>
        </div>
      </div>
      <div className={twoColumns}>
        <section className="flex flex-col gap-3.5">
          <SectionTitle>Course à pied · km par semaine</SectionTitle>
          <Skeleton
            aria-hidden="true"
            className="h-36 w-full rounded-card sm:h-45"
          />
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>Ce qui évolue</SectionTitle>
          <Rows count={4} />
        </section>
      </div>
    </LoadingScope>
  );
}

export function BodyLoading() {
  const view = parseHealthView(useSearchParams().get("view"));
  return (
    <LoadingScope
      label="Chargement du corps"
      className="flex flex-col gap-8 sm:gap-10"
    >
      <section className="grid items-start gap-6.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-3.5">
          <Lede />
          <ScaleSwitch current={view} />
        </div>
        {view !== "day" && (
          <Skeleton aria-hidden="true" className="h-56 w-full rounded-card" />
        )}
      </section>
      {view === "day" ? (
        <div aria-hidden="true" className="flex flex-col gap-6">
          <Skeleton className="h-16 w-full rounded-panel" />
          <Skeleton className="h-72 w-full rounded-panel" />
        </div>
      ) : (
        <div className={twoColumns}>
          <div className="flex flex-col gap-6 max-lg:order-2">
            <section className="flex flex-col gap-3">
              <SectionTitle>Nuits</SectionTitle>
              <Skeleton
                aria-hidden="true"
                className="h-30 w-full rounded-card sm:h-37.5"
              />
            </section>
            <div aria-hidden="true" className="grid gap-3.5 sm:grid-cols-2">
              <Skeleton className="h-40 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          </div>
          <section className="flex flex-col gap-1.5 max-lg:order-1">
            <SectionTitle>Ce qui pèse aujourd’hui</SectionTitle>
            <Rows count={5} />
          </section>
        </div>
      )}
    </LoadingScope>
  );
}

export function RecordsLoading() {
  return (
    <LoadingScope
      label="Chargement des records"
      className="flex min-w-0 flex-col gap-8 sm:gap-10"
    >
      <section className="grid items-start gap-6.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        <Lede />
        <div className="flex flex-col gap-3">
          <SectionTitle>À portée</SectionTitle>
          <Skeleton aria-hidden="true" className="h-56 w-full rounded-card" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionTitle>Tes repères actuels</SectionTitle>
        <div
          aria-hidden="true"
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3"
        >
          {[0, 1, 2, 3].map((item) => (
            <Skeleton
              key={item}
              className="h-24 rounded-card max-sm:last:hidden"
            />
          ))}
        </div>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
        <section className="flex flex-col gap-2">
          <SectionTitle>Vitesse</SectionTitle>
          <Rows count={4} />
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>Endurance</SectionTitle>
          <Rows count={4} />
        </section>
      </div>
    </LoadingScope>
  );
}
