import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { MonoLabel } from "@/components/stride/mono-label";
import { prepLists } from "@/features/races/checklists";
import { ChecklistBoard } from "@/features/races/components/checklist-board";
import { RaceCard } from "@/features/races/components/race-ui";
import { formatDuration } from "@/features/races/format";
import { daysUntil, formatShortDate } from "@/features/races/race";
import { loadRace } from "@/server/races/load";

const phases = [
  { label: "Reprise", width: "flex-[4]", threshold: 120 },
  { label: "Volume", width: "flex-[8]", threshold: 56 },
  { label: "Spécifique", width: "flex-[8]", threshold: 14 },
  { label: "Affûtage", width: "flex-[3]", threshold: -Infinity },
] as const;

export default async function RacePreparationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, today } = await loadRace(id);
  const days = data.race.date ? daysUntil(data.race.date, today) : null;
  const phaseIndex =
    days === null || days < 0
      ? -1
      : phases.findIndex((phase) => days > phase.threshold);
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <RaceCard>
          <MonoLabel>Objectif et projection d’arrivée</MonoLabel>
          <div className="flex items-baseline gap-2">
            <span className="font-metric text-[4rem] leading-none font-semibold tabular-nums">
              {data.race.targetSeconds
                ? formatDuration(data.race.targetSeconds)
                : "—"}
            </span>
            {data.race.targetSeconds && (
              <span className="text-sm text-muted">objectif</span>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-surface-raised" />
          <p className="text-sm leading-relaxed text-muted">
            {data.race.targetSeconds
              ? "Aucune projection calculée pour cette course. Ton objectif reste le repère actuel."
              : "Aucune projection calculée pour cette course. Renseigne ton objectif de temps pour suivre ta préparation."}
          </p>
        </RaceCard>
        <RaceCard>
          <MonoLabel>
            {data.race.date
              ? `Les 4 phases jusqu’au ${formatShortDate(data.race.date)}`
              : "Les 4 phases de préparation"}
          </MonoLabel>
          <div className="flex gap-1.5">
            {phases.map((phase, index) => (
              <div
                key={phase.label}
                className={`flex min-w-0 flex-col gap-2 ${phase.width}`}
              >
                <div
                  className={`h-2 rounded-full ${index === phaseIndex ? "bg-accent" : "bg-surface-raised"}`}
                />
                <span
                  className={`text-xs sm:text-sm ${index === phaseIndex ? "font-semibold" : "text-muted"}`}
                >
                  {phase.label}
                </span>
                {index === phaseIndex && (
                  <span className="text-xs text-muted">tu es ici</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            Repères indicatifs à adapter à ton plan d’entraînement.
          </p>
          <Link
            href="/plan"
            className="inline-flex items-center gap-1 text-sm text-accent hover:text-foreground"
          >
            Voir le plan semaine par semaine{" "}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </RaceCard>
      </div>
      <ChecklistBoard
        raceId={id}
        lists={["key_sessions"]}
        items={data.checklist}
      />
      <ChecklistBoard
        raceId={id}
        lists={prepLists}
        items={data.checklist}
        compact
      />
    </>
  );
}
