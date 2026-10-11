import { Button } from "@/components/ui/button";
import {
  SettingsHeading,
  SettingsGroup,
} from "@/features/settings/components/settings-shell";
import {
  SettingsField,
  SettingsNotice,
} from "@/features/settings/components/form-parts";
import { ChoiceRow } from "@/features/settings/components/choices";
import { RemoveRaceButton } from "@/features/settings/components/remove-race-button";
import {
  goalFocuses,
  formatDuration,
  roadDistancePresets,
  type GoalFocus,
} from "@/features/onboarding/goals";
import { requireAthlete } from "@/server/app/session";
import { readGoals } from "@/server/onboarding/goals";
import {
  addSettingsRace,
  saveSettingsGoal,
  saveSettingsRace,
} from "@/server/settings/actions";

const focusLabels: Record<GoalFocus, string> = {
  general_fitness: "Forme générale",
  faster: "Courir plus vite",
  short_distance: "5K or 10K",
  half_marathon_marathon: "Semi-marathon ou marathon",
  trail: "Trail",
  ultra_trail: "Ultra-trail",
};

function formatRaceDate(value: string | null) {
  if (!value) return "Date à définir";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function RaceInputs({
  race,
  idPrefix,
}: {
  idPrefix: string;
  race?: {
    race_kind: "road" | "trail";
    name: string | null;
    race_date: string | null;
    distance_km: number | null;
    elevation_gain_m: number | null;
    priority: "A" | "B" | "C";
    target_duration_seconds: number | null;
  };
}) {
  return (
    <div className="flex flex-col gap-5">
      <ChoiceRow
        name="race_kind"
        legend="Type de course"
        value={race?.race_kind ?? "road"}
        options={[
          { value: "road", label: "Route" },
          { value: "trail", label: "Trail" },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <SettingsField
          id={`${idPrefix}-name`}
          name="name"
          label="Nom de la course"
          value={race?.name ?? null}
        />
        <SettingsField
          id={`${idPrefix}-date`}
          name="race_date"
          label="Date"
          type="date"
          value={race?.race_date ?? null}
        />
        <SettingsField
          id={`${idPrefix}-distance`}
          name="distance_km"
          label="Distance (km)"
          type="number"
          min={0.01}
          max={1000}
          step="0.01"
          list={`${idPrefix}-road-distances`}
          value={race?.distance_km ?? null}
        />
        <datalist id={`${idPrefix}-road-distances`}>
          {roadDistancePresets.map((distance) => (
            <option key={distance} value={distance} />
          ))}
        </datalist>
        <SettingsField
          id={`${idPrefix}-elevation`}
          name="elevation_gain_m"
          label="Dénivelé positif (m)"
          type="number"
          min={0}
          max={30000}
          step="1"
          value={race?.elevation_gain_m ?? null}
        />
        <SettingsField
          id={`${idPrefix}-duration`}
          name="target_duration"
          label="Temps visé (HH:MM, facultatif)"
          value={race ? formatDuration(race.target_duration_seconds) : null}
        />
      </div>
      <ChoiceRow
        name="priority"
        legend="Priorité"
        value={race?.priority ?? "A"}
        options={["A", "B", "C"].map((value) => ({ value, label: value }))}
      />
    </div>
  );
}

export default async function GoalsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const goals = await readGoals(context);
  const races = goals.races.toSorted((a, b) =>
    (a.values.race_date ?? "9999").localeCompare(b.values.race_date ?? "9999"),
  );
  const primary = races.find(
    (race) =>
      race.values.priority === "A" && race.values.race_date && race.values.name,
  );
  return (
    <>
      <SettingsHeading
        title="Objectifs et courses"
        description="Ta course prioritaire et ton objectif donnent du contexte à Stride pour tes futurs entraînements."
      />
      <SettingsNotice status={query.status} />
      {primary && (
        <div className="mb-9 rounded-surface border border-accent p-5">
          <span className="font-mono text-label tracking-wider text-accent uppercase">
            Objectif principal
          </span>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-xl">{primary.values.name}</strong>
            <span className="text-muted">
              {formatRaceDate(primary.values.race_date)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {primary.values.distance_km} km
            {primary.values.elevation_gain_m
              ? ` · ${primary.values.elevation_gain_m} m D+`
              : ""}
            {primary.values.target_duration_seconds
              ? ` · objectif ${formatDuration(primary.values.target_duration_seconds)}`
              : ""}
          </p>
        </div>
      )}
      <SettingsGroup title="Objectif de course">
        <form action={saveSettingsGoal} className="p-4 md:px-0">
          <input
            type="hidden"
            name="revision"
            value={goals.goal.revision ?? ""}
          />
          <label htmlFor="focus" className="mb-2 block text-sm font-medium">
            Quel est ton objectif ?
          </label>
          <select
            id="focus"
            name="focus"
            defaultValue={goals.goal.values.focus ?? ""}
            className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            {goalFocuses.map((focus) => (
              <option key={focus} value={focus}>
                {focusLabels[focus]}
              </option>
            ))}
          </select>
          <Button type="submit" className="mt-4">
            Enregistrer l’objectif
          </Button>
        </form>
      </SettingsGroup>
      <SettingsGroup title="Tes courses">
        {races.length === 0 ? (
          <p className="p-4 text-sm text-muted md:px-0">
            Aucune course ajoutée.
          </p>
        ) : (
          races.map((race) => (
            <details
              key={race.id}
              className="border-b border-border p-4 last:border-b-0 md:px-0"
            >
              <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
                {race.values.name ?? "Course sans nom"}
                <span className="ml-3 font-normal text-muted">
                  {race.values.priority} ·{" "}
                  {formatRaceDate(race.values.race_date)} ·{" "}
                  {race.values.distance_km ?? "—"} km
                </span>
              </summary>
              <form
                action={saveSettingsRace}
                aria-label={`Modifier ${race.values.name ?? "la course"}`}
                className="mt-5"
              >
                <input type="hidden" name="id" value={race.id} />
                <input
                  type="hidden"
                  name="revision"
                  value={race.revision ?? ""}
                />
                <RaceInputs race={race.values} idPrefix={race.id} />
                <Button type="submit" className="mt-5">
                  Enregistrer la course
                </Button>
              </form>
              <div className="mt-2">
                <RemoveRaceButton
                  id={race.id}
                  name={race.values.name ?? "cette course"}
                />
              </div>
            </details>
          ))
        )}
      </SettingsGroup>
      {races.length < 10 && (
        <SettingsGroup title="Ajouter une course">
          <form
            action={addSettingsRace}
            aria-label="Ajouter la course"
            className="p-4 md:px-0"
          >
            <RaceInputs idPrefix="new-race" />
            <Button type="submit" className="mt-5">
              Ajouter la course
            </Button>
          </form>
        </SettingsGroup>
      )}
    </>
  );
}
