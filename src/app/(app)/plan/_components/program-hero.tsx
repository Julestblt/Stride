import { PlusIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type { RaceProgram } from "@/features/plans/view/program";

function programHref(program: RaceProgram, primary: boolean) {
  return primary || !program.raceId ? "/plan" : `/plan?race=${program.raceId}`;
}

export function ProgramTabs({
  programs,
  active,
}: {
  programs: RaceProgram[];
  active: RaceProgram;
}) {
  const tabs = programs.filter((program) => program.tab !== null);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3.5",
        tabs.length === 0 && "max-sm:hidden",
      )}
    >
      {tabs.length > 0 && (
        <nav
          aria-label="Programmes"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 max-sm:w-[calc(100%+2.5rem)] sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {tabs.map((program, index) => {
            const tab = program.tab!;
            const current = program === active;
            return (
              <Link
                key={program.raceId ?? "plan"}
                href={programHref(program, index === 0)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-12 shrink-0 items-center gap-2.5 rounded-[10px] border px-3 sm:min-h-13 sm:px-3.5",
                  current
                    ? "border-dim bg-surface-raised"
                    : "border-border hover:bg-surface",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-[6px] font-metric text-[13px] font-bold",
                    tab.primary
                      ? "bg-accent text-accent-foreground"
                      : "border-[1.5px] border-dim text-muted",
                  )}
                >
                  {tab.letter}
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span
                    className={cn(
                      "text-sm font-semibold whitespace-nowrap",
                      current ? "text-foreground" : "text-muted",
                    )}
                  >
                    <span className="sr-only">Course {tab.letter} · </span>
                    {tab.name}
                  </span>
                  {tab.when && (
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {tab.when}
                    </span>
                  )}
                </span>
                {tab.detail && (
                  <span
                    className={cn(
                      "ml-1.5 text-[11px] whitespace-nowrap max-sm:hidden",
                      current ? "text-muted" : "text-muted-foreground",
                    )}
                  >
                    {tab.detail}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/races"
            aria-label="Nouveau programme"
            className="grid min-h-12 w-12 shrink-0 place-items-center rounded-[10px] border border-dashed border-border-strong text-muted-foreground hover:text-foreground sm:min-h-13 sm:w-13"
          >
            <PlusIcon aria-hidden="true" className="size-4.5" />
          </Link>
        </nav>
      )}
      <Button
        asChild
        variant="outline"
        size="md"
        className="ml-auto text-[13px] text-muted max-sm:hidden"
      >
        <Link href="/plan/week">Liste complète</Link>
      </Button>
    </div>
  );
}

export function ProgramHeader({ program }: { program: RaceProgram }) {
  return (
    <section className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-7">
      <div className="flex flex-col gap-1.5 sm:mr-auto">
        <MonoLabel size="nano" className="sm:text-label">
          {program.eyebrow}
        </MonoLabel>
        <h1 className="text-2xl leading-[1.1] font-semibold tracking-[-0.02em] text-balance sm:text-[34px] sm:leading-[1.05] sm:tracking-[-0.025em]">
          {program.title}
        </h1>
        {program.summary && (
          <p className="max-w-190 text-[13px] leading-[1.45] text-pretty text-muted-foreground sm:hidden">
            {program.summary}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:flex sm:gap-7">
        {program.kpis.map((kpi, index) => (
          <div
            key={kpi.key}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 sm:gap-0.75",
              index > 2 && "max-sm:hidden",
            )}
          >
            <dt className="order-2">
              <MonoLabel size="nano" className="text-[8.5px] sm:text-[9px]">
                {kpi.label}
              </MonoLabel>
            </dt>
            <dd className="order-1 font-metric text-xl leading-none font-semibold whitespace-nowrap tabular-nums sm:text-[26px]">
              {kpi.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
