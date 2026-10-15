"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type {
  MilestoneTone,
  ProgramMilestone,
  RaceProgram,
} from "@/features/plans/view/program";
import { ProgramChart } from "./program-chart";
import { ProgramWeekPanel } from "./program-week";

const milestoneTones: Record<MilestoneTone, string> = {
  provider: "bg-provider",
  accent: "bg-accent",
  terrain: "bg-zone-3",
  quality: "bg-zone-4",
  success: "bg-success",
};

function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function Milestones({
  milestones,
  onSelect,
}: {
  milestones: ProgramMilestone[];
  onSelect: (weekKey: string) => void;
}) {
  return (
    <section
      aria-labelledby="program-milestones"
      className="flex flex-col gap-2.5"
    >
      <MonoLabel id="program-milestones">Repères du programme</MonoLabel>
      <ul className="flex flex-wrap gap-2">
        {milestones.map((milestone) => (
          <li key={milestone.key}>
            <button
              type="button"
              onClick={() => onSelect(milestone.weekKey)}
              className="flex min-h-8.5 items-center gap-2 rounded-full border border-border px-3 text-[13px] whitespace-nowrap hover:border-border-strong hover:bg-surface"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  milestoneTones[milestone.tone],
                )}
              />
              <span className="font-metric text-sm font-semibold text-muted-foreground tabular-nums">
                S{milestone.number}
              </span>
              {milestone.label}
              <span className="text-xs text-muted-foreground">
                {milestone.when}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgramExplorer({
  program,
  initialWeekKey,
}: {
  program: RaceProgram;
  initialWeekKey: string | null;
}) {
  const { weeks } = program;
  const [selected, setSelected] = useState(
    initialWeekKey ?? program.defaultWeekKey,
  );
  const [requested, setRequested] = useState(initialWeekKey);
  if (requested !== initialWeekKey) {
    setRequested(initialWeekKey);
    if (initialWeekKey) setSelected(initialWeekKey);
  }
  const index = weeks.findIndex((week) => week.weekKey === selected);
  const week = weeks[index] ?? null;

  const select = useCallback(
    (weekKey: string) => {
      const target = weeks.find((item) => item.weekKey === weekKey);
      if (!target) return;
      setSelected(weekKey);
      const url = new URL(window.location.href);
      url.searchParams.set("week", target.weekStart);
      window.history.replaceState(null, "", url);
    },
    [weeks],
  );

  const step = useCallback(
    (offset: number) => {
      const next = weeks[index + offset];
      if (next) select(next.weekKey);
    },
    [weeks, index, select],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        typing(event.target)
      )
        return;
      if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  const navigation = (
    <div className="ml-auto flex items-center gap-1.5 max-sm:hidden">
      <MonoLabel size="nano" className="mr-1.5 max-lg:hidden">
        ← → au clavier
      </MonoLabel>
      <Button
        variant="outline"
        size="icon"
        aria-label="Semaine précédente"
        disabled={index <= 0}
        onClick={() => step(-1)}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      {program.defaultWeekKey && (
        <Button
          variant="outline"
          size="md"
          className="min-h-9 text-xs"
          aria-pressed={selected === program.defaultWeekKey}
          onClick={() => select(program.defaultWeekKey!)}
        >
          Aujourd’hui
        </Button>
      )}
      <Button
        variant="outline"
        size="icon"
        aria-label="Semaine suivante"
        disabled={index < 0 || index >= weeks.length - 1}
        onClick={() => step(1)}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <>
      <ProgramChart
        weeks={weeks}
        bands={program.bands}
        nested={program.nested}
        selected={selected}
        onSelect={select}
      />
      {week && (
        <ProgramWeekPanel
          week={week}
          navigation={navigation}
          sessionHref={(sessionKey) => {
            const query = new URLSearchParams();
            if (program.raceId) query.set("race", program.raceId);
            query.set("week", week.weekStart);
            query.set("seance", sessionKey);
            return `/plan?${query}`;
          }}
        />
      )}
      {program.milestones.length > 0 && (
        <Milestones milestones={program.milestones} onSelect={select} />
      )}
    </>
  );
}
