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
  general_fitness: "General fitness",
  faster: "Run faster",
  short_distance: "5K or 10K",
  half_marathon_marathon: "Half marathon or marathon",
  trail: "Trail running",
  ultra_trail: "Ultra trail",
};

function RaceInputs({
  race,
  idPrefix,
}: {
  idPrefix: string;
  race?: {
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
      <div className="grid gap-5 md:grid-cols-2">
        <SettingsField
          id={`${idPrefix}-name`}
          name="name"
          label="Race name"
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
          value={race?.distance_km ?? null}
        />
        <SettingsField
          id={`${idPrefix}-elevation`}
          name="elevation_gain_m"
          label="Elevation gain (m)"
          type="number"
          min={0}
          max={30000}
          step="1"
          value={race?.elevation_gain_m ?? null}
        />
        <SettingsField
          id={`${idPrefix}-duration`}
          name="target_duration"
          label="Target time (HH:MM, optional)"
          value={race ? formatDuration(race.target_duration_seconds) : null}
        />
      </div>
      <ChoiceRow
        name="priority"
        legend="Priority"
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
        title="Goals and races"
        description="Your priority race and running goal give Stride the context for future training plans."
      />
      <SettingsNotice status={query.status} />
      {primary && (
        <div className="mb-9 rounded-surface border border-accent p-5">
          <span className="font-mono text-label tracking-wider text-accent uppercase">
            Primary goal
          </span>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-xl">{primary.values.name}</strong>
            <span className="text-muted">{primary.values.race_date}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {primary.values.distance_km} km
            {primary.values.elevation_gain_m
              ? ` · ${primary.values.elevation_gain_m} m ascent`
              : ""}
            {primary.values.target_duration_seconds
              ? ` · target ${formatDuration(primary.values.target_duration_seconds)}`
              : ""}
          </p>
        </div>
      )}
      <SettingsGroup title="Running goal">
        <form action={saveSettingsGoal} className="p-4 md:px-0">
          <input
            type="hidden"
            name="revision"
            value={goals.goal.revision ?? ""}
          />
          <label htmlFor="focus" className="mb-2 block text-sm font-medium">
            What are you working toward?
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
            Save goal
          </Button>
        </form>
      </SettingsGroup>
      <SettingsGroup title="Your races">
        {races.length === 0 ? (
          <p className="p-4 text-sm text-muted md:px-0">No races added yet.</p>
        ) : (
          races.map((race) => (
            <details
              key={race.id}
              className="border-b border-border p-4 last:border-b-0 md:px-0"
            >
              <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
                {race.values.name ?? "Unnamed race"}
                <span className="ml-3 font-normal text-muted">
                  {race.values.priority} · {race.values.race_date ?? "Set date"}{" "}
                  · {race.values.distance_km ?? "—"} km
                </span>
              </summary>
              <form
                action={saveSettingsRace}
                aria-label={`Edit ${race.values.name ?? "race"}`}
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
                  Save race
                </Button>
              </form>
              <div className="mt-2">
                <RemoveRaceButton
                  id={race.id}
                  name={race.values.name ?? "this race"}
                />
              </div>
            </details>
          ))
        )}
      </SettingsGroup>
      {races.length < 10 && (
        <SettingsGroup title="Add a race">
          <form
            action={addSettingsRace}
            aria-label="Add race"
            className="p-4 md:px-0"
          >
            <RaceInputs idPrefix="new-race" />
            <Button type="submit" className="mt-5">
              Add race
            </Button>
          </form>
        </SettingsGroup>
      )}
    </>
  );
}
