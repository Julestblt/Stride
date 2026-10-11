"use client";
import { useCallback, useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SaveRequest } from "@/features/onboarding/autosave";
import {
  formatDuration,
  missingRaceFields,
  parseDuration,
  roadDistancePresets,
  type RaceSnapshot,
  type RaceValues,
} from "@/features/onboarding/goals";
import { saveAthleteRace } from "@/server/onboarding/actions";
import {
  ChoiceField,
  DateField,
  NumberField,
  SaveIndicator,
  TextField,
} from "./about-fields";
import { useAutosave, type AutosaveResult } from "./use-autosave";

export type RaceHandle = {
  flush: () => Promise<boolean>;
  values: () => RaceValues;
};
const raceFields: (keyof RaceValues)[] = [
  "race_kind",
  "name",
  "race_date",
  "distance_km",
  "elevation_gain_m",
  "priority",
  "target_duration_seconds",
];
const required = "Requis pour garder cette course.";

export function RaceForm({
  race,
  index,
  showErrors,
  register,
  onRemove,
  onMissing,
  removing,
}: {
  race: RaceSnapshot;
  index: number;
  showErrors: boolean;
  register: (id: string, handle: RaceHandle | null) => void;
  onRemove: () => void;
  onMissing: () => void;
  removing: boolean;
}) {
  const save = useCallback(
    async (
      request: SaveRequest<RaceValues>,
    ): Promise<AutosaveResult<RaceValues>> => {
      const result = await saveAthleteRace({
        id: race.id,
        values: request.values,
        revision: request.revision,
      });
      if (result.status === "missing") {
        onMissing();
        return { status: "invalid" };
      }
      return result;
    },
    [onMissing, race.id],
  );
  const { state, change, flush, retry, resolve } = useAutosave<RaceValues>({
    initial: { values: race.values, revision: race.revision },
    save,
    cacheKey: `stride:onboarding:race:${race.id}`,
    cacheFields: raceFields,
    serverUpdatedAt: race.updatedAt,
  });
  const local = state.local;
  useEffect(() => {
    register(race.id, { flush, values: () => local });
    return () => register(race.id, null);
  }, [flush, local, race.id, register]);
  const missing = showErrors ? missingRaceFields(local) : [];
  const [resetKey, setResetKey] = useState(0);
  const [distanceKey, setDistanceKey] = useState(0);
  const [durationText, setDurationText] = useState(
    formatDuration(race.values.target_duration_seconds),
  );
  const [durationInvalid, setDurationInvalid] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <fieldset className="flex flex-col gap-5 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">Course {index + 1}</legend>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-label text-muted-foreground uppercase">
          Course {index + 1}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={removing}
          aria-busy={removing}
          onClick={onRemove}
        >
          <XIcon data-icon="inline-start" />
          Retirer
        </Button>
      </div>
      <div key={resetKey} className="contents">
        <ChoiceField
          label="Type de course"
          value={local.race_kind}
          options={[
            { value: "road", label: "Route" },
            { value: "trail", label: "Trail" },
          ]}
          onChange={(value) => value && change("race_kind", value, "now")}
        />
        <TextField
          id={`race-${race.id}-name`}
          label="Course"
          maxLength={120}
          value={local.name}
          error={missing.includes("name") ? required : undefined}
          onCommit={(value) => change("name", value)}
        />
        <div className="grid gap-5 lg:grid-cols-3">
          <DateField
            id={`race-${race.id}-date`}
            label="Date"
            min={today}
            longDate
            value={local.race_date}
            error={missing.includes("race_date") ? required : undefined}
            onCommit={(value) => change("race_date", value)}
          />
          <div className="grid grid-cols-2 gap-5 lg:col-span-2">
            <div className="flex flex-col gap-2">
              <NumberField
                key={distanceKey}
                id={`race-${race.id}-distance`}
                label="Distance"
                unit="km"
                min={0.1}
                max={1000}
                value={local.distance_km}
                error={missing.includes("distance_km") ? required : undefined}
                onCommit={(value) => change("distance_km", value)}
              />
              {local.race_kind === "road" && (
                <div
                  className="flex flex-wrap gap-1.5"
                  aria-label="Distances classiques sur route"
                >
                  {roadDistancePresets.map((distance) => (
                    <Button
                      key={distance}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        change("distance_km", distance);
                        setDistanceKey((key) => key + 1);
                      }}
                    >
                      {distance === 21.1
                        ? "Semi-marathon"
                        : distance === 42.2
                          ? "Marathon"
                          : `${distance} km`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <NumberField
              id={`race-${race.id}-elevation`}
              label="D+"
              unit="m"
              min={0}
              max={30_000}
              integer
              value={local.elevation_gain_m}
              onCommit={(value) => change("elevation_gain_m", value)}
            />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ChoiceField
            label="Priorité"
            value={local.priority}
            options={[
              { value: "A", label: "A · principal" },
              { value: "B", label: "B" },
              { value: "C", label: "C · préparation" },
            ]}
            onChange={(value) => value && change("priority", value, "now")}
          />
          <Field data-invalid={durationInvalid}>
            <FieldLabel htmlFor={`race-${race.id}-target`}>
              Objectif de temps
              <span className="font-normal text-muted-foreground">
                · facultatif
              </span>
            </FieldLabel>
            <Input
              id={`race-${race.id}-target`}
              inputMode="numeric"
              placeholder="ex. 18:30"
              value={durationText}
              aria-invalid={durationInvalid || undefined}
              onChange={(event) => {
                setDurationText(event.target.value);
                const seconds = parseDuration(event.target.value);
                if (seconds !== undefined) {
                  setDurationInvalid(false);
                  change("target_duration_seconds", seconds);
                }
              }}
              onBlur={() =>
                setDurationInvalid(parseDuration(durationText) === undefined)
              }
            />
            <FieldDescription className={durationInvalid ? "text-warning" : ""}>
              {durationInvalid
                ? "Format attendu : heures:minutes, par exemple 3:45."
                : "Laisse vide si tu n’as pas d’objectif chrono."}
            </FieldDescription>
          </Field>
        </div>
      </div>
      {state.conflicts.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-warning-border p-3 text-sm"
        >
          <span>Cette course a changé sur un autre appareil.</span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                state.conflicts.forEach((field) => resolve(field, "mine"))
              }
            >
              Garder ma version
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                state.conflicts.forEach((field) => resolve(field, "theirs"));
                setResetKey((key) => key + 1);
              }}
            >
              Reprendre l’autre
            </Button>
          </span>
        </div>
      )}
      {state.status !== "saved" && state.status !== "conflict" && (
        <SaveIndicator status={state.status} onRetry={() => void retry()} />
      )}
    </fieldset>
  );
}
