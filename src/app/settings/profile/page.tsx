import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SettingsHeading,
  SettingsGroup,
} from "@/features/settings/components/settings-shell";
import { SettingsNotice } from "@/features/settings/components/form-parts";
import type { ValueSource } from "@/features/onboarding/profile";
import { requireAthlete } from "@/server/app/session";
import { readProfile } from "@/server/onboarding/profile";
import { saveSettingsProfile } from "@/server/settings/actions";
import { readProfileMetrics } from "@/server/settings/data";

function ProfileRow({
  name,
  label,
  value,
  source,
  type = "text",
  min,
  max,
  step,
  note,
}: {
  name: string;
  label: string;
  value: string | number | null;
  source?: ValueSource;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
  note?: string;
}) {
  const provenance =
    source?.source === "garmin"
      ? `Garmin · ${source.observed_on}`
      : source?.source === "athlete"
        ? "Your answer"
        : "Entered in Stride";
  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(8rem,1.2fr)] items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3.5 last:border-b-0 md:grid-cols-[12rem_20rem_minmax(0,1fr)] md:px-0">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        min={min}
        max={max}
        step={step}
        required
        defaultValue={value ?? ""}
        className="h-10 md:h-10"
      />
      <span className="col-span-2 text-xs text-muted md:col-span-1">
        {provenance}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const [profile, metrics] = await Promise.all([
    readProfile(context),
    readProfileMetrics(context),
  ]);
  const values = profile.values;
  return (
    <>
      <SettingsHeading
        title="Profile"
        description="Review your details. Values you edit become yours and are not replaced by later Garmin updates."
      />
      <SettingsNotice status={query.status} />
      <form action={saveSettingsProfile}>
        <input type="hidden" name="revision" value={profile.revision ?? ""} />
        <SettingsGroup title="You">
          <ProfileRow
            name="first_name"
            label="First name"
            value={values.first_name}
            source={values.value_sources.first_name}
          />
          <ProfileRow
            name="birth_date"
            label="Date of birth"
            value={values.birth_date}
            source={values.value_sources.birth_date}
            type="date"
            note="Used for age-related estimates"
          />
          <div className="border-b border-border px-4 py-4 md:px-0">
            <fieldset className="grid gap-2 md:grid-cols-[12rem_20rem_minmax(0,1fr)] md:items-center">
              <legend className="mb-3 text-sm font-medium md:float-left md:mb-0">
                Sex for estimates
              </legend>
              <div className="flex gap-1">
                {[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                  { value: "unspecified", label: "Not specified" },
                ].map((option) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="sex"
                      value={option.value}
                      defaultChecked={values.sex === option.value}
                      required
                    />
                    <span className="inline-flex min-h-10 items-center rounded-control border border-border-strong px-2 text-xs text-muted peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
              <span className="text-xs text-muted">
                Used only for energy and heart rate estimates
              </span>
            </fieldset>
          </div>
          <ProfileRow
            name="height_cm"
            label="Height (cm)"
            value={values.height_cm}
            source={values.value_sources.height_cm}
            type="number"
            min={100}
            max={250}
            step="0.1"
          />
          <ProfileRow
            name="weight_kg"
            label="Weight (kg)"
            value={values.weight_kg}
            source={values.value_sources.weight_kg}
            type="number"
            min={25}
            max={250}
            step="0.1"
          />
        </SettingsGroup>
        <Button type="submit">Save profile</Button>
      </form>
      {metrics.length > 0 && (
        <SettingsGroup title="From your training">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[12rem_20rem_minmax(0,1fr)] md:px-0"
            >
              <strong className="text-sm font-medium">{metric.label}</strong>
              <span className="font-metric text-xl font-semibold md:col-start-2">
                {metric.value} {metric.unit}
              </span>
              <span className="col-span-2 text-xs text-muted md:col-span-1">
                Garmin{metric.date ? ` · ${metric.date.slice(0, 10)}` : ""}
              </span>
            </div>
          ))}
        </SettingsGroup>
      )}
    </>
  );
}
