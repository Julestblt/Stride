import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type { HistoryFilter } from "@/features/plans/review/history";
import { requireAthlete } from "@/server/app/session";
import { readPlanHistory } from "@/server/plans/proposals";
import { PlanFrame } from "../_components/plan-frame";
import { HistoryEntry } from "./_components/history-entry";

export const metadata: Metadata = { title: "Historique · Plan" };

const filterSlugs: Record<HistoryFilter, string> = {
  all: "tout",
  pending: "a-decider",
  applied: "appliquees",
  rejected: "refusees",
  other: "autres",
};

function filterOf(value: string | string[] | undefined): HistoryFilter {
  const match = Object.entries(filterSlugs).find(([, slug]) => slug === value);
  return match ? (match[0] as HistoryFilter) : "all";
}

export default async function PlanHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const history = await readPlanHistory(context, filterOf(query.filtre));
  return (
    <PlanFrame
      crumbs={[{ label: "Plan", href: "/plan" }, { label: "Historique" }]}
      className="max-w-260 gap-5 sm:gap-5 sm:pt-7"
    >
      <Link
        href="/plan"
        className="-mt-2 -mb-2 flex min-h-11 items-center gap-1.5 self-start text-sm text-muted hover:text-foreground sm:hidden"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
        Retour au plan
      </Link>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[30px]">
            Historique du plan
          </h1>
          {history.subtitle && (
            <p className="text-sm text-muted">{history.subtitle}</p>
          )}
        </div>
        {!history.empty && (
          <nav
            aria-label="Filtrer par statut"
            className="-mx-5 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-5 max-sm:w-[calc(100%+2.5rem)] sm:mx-0 sm:ml-auto sm:flex-wrap sm:px-0"
          >
            {history.filters.map((filter) => {
              const current = filter.key === history.filter;
              return (
                <Link
                  key={filter.key}
                  href={
                    filter.key === "all"
                      ? "/plan/historique"
                      : `/plan/historique?filtre=${filterSlugs[filter.key]}`
                  }
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[13px] whitespace-nowrap",
                    current
                      ? "border-foreground bg-foreground font-semibold text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label} · {filter.count}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      {history.empty ? (
        <p className="rounded-card border border-border bg-surface px-4 py-3.5 text-sm leading-normal text-muted">
          Aucune proposition pour l’instant. Les changements proposés par Claire
          apparaîtront ici, avec ta décision.
        </p>
      ) : history.groups.length === 0 ? (
        <p className="text-sm text-muted">
          Aucune proposition ne correspond à ce filtre.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 sm:gap-1.5">
          {history.groups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`month-${group.key}`}
              className="flex flex-col gap-2.5 sm:gap-1.5"
            >
              <MonoLabel asChild size="micro">
                <h2
                  id={`month-${group.key}`}
                  className="pt-2.5 pb-0.5 sm:pt-3.5 sm:pb-1"
                >
                  {group.label}
                </h2>
              </MonoLabel>
              {group.entries.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} />
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Chaque changement de ton plan passe par une proposition que tu acceptes
        ou refuses. Rien ne change sans ton accord.
      </p>
    </PlanFrame>
  );
}
