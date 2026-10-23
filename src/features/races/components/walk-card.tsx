"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { MonoLabel } from "@/components/stride/mono-label";
import { formatDecimal, formatPace } from "../format";
import { actionMessage } from "../messages";
import { saveRacePlan } from "@/server/races/actions";
import { CardLabel, Figure, RaceCard, StatusPill } from "./race-ui";

export type WalkRow = { threshold: number; count: number; distanceM: number };

export function WalkCard({
  raceId,
  revision,
  threshold,
  paceSecondsPerKm,
  rows,
  applied,
}: {
  raceId: string;
  revision: number | null;
  threshold: number;
  paceSecondsPerKm: number;
  rows: WalkRow[];
  applied: boolean;
}) {
  const [value, setValue] = useState(threshold);
  const [pending, startTransition] = useTransition();
  const current = rows.find((row) => row.threshold === value) ?? rows[0];
  const around = [value - 2, value, value + 2]
    .map((item) => rows.find((row) => row.threshold === item))
    .filter((row): row is WalkRow => Boolean(row));
  const minutes = Math.round(
    ((current.distanceM / 1000) * paceSecondsPerKm) / 60,
  );

  function commit(next: number) {
    if (next === threshold) return;
    startTransition(async () => {
      const result = await saveRacePlan(raceId, revision, {
        walkGradePercent: next,
      });
      if (result.status !== "saved") {
        toast.error(actionMessage(result.status), { id: "walk-grade" });
        setValue(threshold);
        return;
      }
      toast.success("Seuil de marche enregistré.", { id: "walk-grade" });
    });
  }

  return (
    <RaceCard aria-busy={pending}>
      <div className="flex items-center justify-between">
        <CardLabel>Marche rapide</CardLabel>
        {applied && (
          <StatusPill tone="accent">Appliquée à la simulation</StatusPill>
        )}
      </div>
      <label htmlFor="walk-grade" className="text-body">
        Je marche dès{" "}
        <b className="font-metric text-[1.375rem] font-semibold text-accent">
          {value} %
        </b>{" "}
        de pente
      </label>
      <Slider
        id="walk-grade"
        min={5}
        max={20}
        step={1}
        value={[value]}
        onValueChange={([next]) => setValue(next)}
        onValueCommit={([next]) => commit(next)}
        aria-valuetext={`${value} %`}
        disabled={pending}
      />
      <div className="flex justify-between">
        <MonoLabel size="nano">5 %</MonoLabel>
        <MonoLabel size="nano">20 %</MonoLabel>
      </div>
      <div className="flex gap-6">
        <Figure
          value={current.count}
          label={current.count > 1 ? "portions" : "portion"}
        />
        <Figure
          value={`${formatDecimal(current.distanceM / 1000)} km`}
          label="à la marche"
        />
        <Figure
          value={`~${minutes} min`}
          label={`à ${formatPace(paceSecondsPerKm)} /km`}
        />
      </div>
      <div>
        {around.map((row) => (
          <div
            key={row.threshold}
            className={cn(
              "grid grid-cols-[52px_1fr_auto] gap-2.5 border-t border-border-subtle py-1.5 text-meta",
              row.threshold === value
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <span className="font-metric text-base">{row.threshold} %</span>
            <span>
              {row.count} {row.count > 1 ? "portions" : "portion"}
            </span>
            <span className="font-metric text-base">
              {formatDecimal(row.distanceM / 1000)} km
            </span>
          </div>
        ))}
      </div>
      <p className="text-meta text-muted-foreground">
        Pente mesurée sur 100 m glissants du GPX. Marche comptée à{" "}
        {formatPace(paceSecondsPerKm)} /km dans la simulation.
      </p>
    </RaceCard>
  );
}
