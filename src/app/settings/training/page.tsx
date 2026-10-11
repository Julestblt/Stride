import { Button } from "@/components/ui/button";
import {
  SettingsHeading,
  SettingsGroup,
  UnavailableSettingRow,
} from "@/features/settings/components/settings-shell";
import { ChoiceRow } from "@/features/settings/components/choices";
import { SettingsNotice } from "@/features/settings/components/form-parts";
import { requireAthlete } from "@/server/app/session";
import { readProfile } from "@/server/onboarding/profile";
import { saveSettingsTraining } from "@/server/settings/actions";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const access = [
  { value: "hills", label: "Hills" },
  { value: "incline_treadmill", label: "Incline treadmill" },
  { value: "gym", label: "Gym" },
  { value: "track", label: "Track" },
];

export default async function TrainingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const profile = await readProfile(context);
  const values = profile.values;
  return (
    <>
      <SettingsHeading
        title="Training"
        description="Your running availability and terrain help Stride understand your training context."
      />
      <SettingsNotice status={query.status} />
      <form action={saveSettingsTraining}>
        <input type="hidden" name="revision" value={profile.revision ?? ""} />
        <SettingsGroup title="Training">
          <ChoiceRow
            name="primary_terrain"
            legend="Primary terrain"
            value={values.primary_terrain}
            options={[
              { value: "road", label: "Road" },
              { value: "trail", label: "Trail" },
              { value: "mixed", label: "Both" },
            ]}
          />
          <fieldset className="border-b border-border px-4 py-4 md:px-0">
            <legend className="mb-3 text-sm font-medium">Running days</legend>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day, index) => (
                <label key={day} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    name="available_weekdays"
                    value={index + 1}
                    defaultChecked={values.available_weekdays?.includes(
                      index + 1,
                    )}
                  />
                  <span className="grid size-10 place-items-center rounded-full border border-border-strong text-xs text-muted peer-checked:border-accent peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                    {day}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <ChoiceRow
            name="long_run_day"
            legend="Long run day"
            value={values.long_run_day}
            options={[
              { value: "saturday", label: "Saturday" },
              { value: "sunday", label: "Sunday" },
              { value: "flexible", label: "Flexible" },
            ]}
          />
          <ChoiceRow
            name="weekday_session_minutes"
            legend="Weekday session length"
            value={String(values.weekday_session_minutes ?? "")}
            options={[45, 60, 75, 90].map((minutes) => ({
              value: String(minutes),
              label: minutes === 90 ? "90+ min" : `${minutes} min`,
            }))}
          />
          <fieldset className="px-4 py-4 md:px-0">
            <legend className="mb-3 text-sm font-medium">
              Training access
            </legend>
            <div className="flex flex-wrap gap-2">
              {access.map((item) => (
                <label key={item.value} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    name="training_access"
                    value={item.value}
                    defaultChecked={values.training_access?.includes(
                      item.value,
                    )}
                  />
                  <span className="inline-flex min-h-10 items-center rounded-control border border-border-strong px-3 text-sm text-muted peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </SettingsGroup>
        <Button type="submit">Save training preferences</Button>
      </form>
      <div className="mt-9">
        <SettingsGroup title="Units">
          <UnavailableSettingRow
            title="Distance and ascent"
            detail="Stride currently displays kilometres and metres."
            value="km · m"
          />
          <UnavailableSettingRow
            title="Pace"
            detail="Recorded running pace is displayed per kilometre."
            value="min/km"
          />
        </SettingsGroup>
      </div>
      <SettingsGroup title="Coach">
        <UnavailableSettingRow
          title="Tone and detail"
          detail="Coach conversations are not available yet."
        />
        <UnavailableSettingRow
          title="Plan changes"
          detail="Training plans and approval rules are not available yet."
        />
        <UnavailableSettingRow
          title="Proactive advice"
          detail="Stride does not send unsolicited coaching advice yet."
        />
      </SettingsGroup>
      <div id="notifications">
        <SettingsGroup title="Notifications">
          <UnavailableSettingRow
            title="Reminders and alerts"
            detail="Notifications are not delivered by Stride yet."
          />
        </SettingsGroup>
      </div>
    </>
  );
}
