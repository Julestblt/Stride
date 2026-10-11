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

const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const access = [
  { value: "hills", label: "Côtes" },
  { value: "incline_treadmill", label: "Tapis incliné" },
  { value: "gym", label: "Salle de sport" },
  { value: "track", label: "Piste" },
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
        title="Entraînement et coach"
        description="Tes disponibilités et ton terrain de course aident Stride à comprendre ton entraînement."
      />
      <SettingsNotice status={query.status} />
      <form action={saveSettingsTraining}>
        <input type="hidden" name="revision" value={profile.revision ?? ""} />
        <SettingsGroup title="Entraînement et coach">
          <ChoiceRow
            name="primary_terrain"
            legend="Terrain principal"
            value={values.primary_terrain}
            options={[
              { value: "road", label: "Route" },
              { value: "trail", label: "Trail" },
              { value: "mixed", label: "Les deux" },
            ]}
          />
          <fieldset className="border-b border-border px-4 py-4 md:px-0">
            <legend className="mb-3 text-sm font-medium">
              Jours de course
            </legend>
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
            legend="Jour de sortie longue"
            value={values.long_run_day}
            options={[
              { value: "saturday", label: "Samedi" },
              { value: "sunday", label: "Dimanche" },
              { value: "flexible", label: "Flexible" },
            ]}
          />
          <ChoiceRow
            name="weekday_session_minutes"
            legend="Durée des séances en semaine"
            value={String(values.weekday_session_minutes ?? "")}
            options={[45, 60, 75, 90].map((minutes) => ({
              value: String(minutes),
              label: minutes === 90 ? "90+ min" : `${minutes} min`,
            }))}
          />
          <fieldset className="px-4 py-4 md:px-0">
            <legend className="mb-3 text-sm font-medium">
              Équipements disponibles
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
        <Button type="submit">Enregistrer les préférences</Button>
      </form>
      <div className="mt-9">
        <SettingsGroup title="Unités">
          <UnavailableSettingRow
            title="Distance et dénivelé"
            detail="Stride affiche les kilomètres et les mètres."
            value="km · m"
          />
          <UnavailableSettingRow
            title="Allure"
            detail="L’allure est affichée au kilomètre."
            value="min/km"
          />
        </SettingsGroup>
      </div>
      <SettingsGroup title="Coach">
        <UnavailableSettingRow
          title="Ton et niveau de détail"
          detail="Les conversations avec le coach ne sont pas encore disponibles."
        />
        <UnavailableSettingRow
          title="Modifications du plan"
          detail="Les plans d’entraînement ne sont pas encore disponibles."
        />
        <UnavailableSettingRow
          title="Conseils spontanés"
          detail="Stride ne propose pas encore de conseils spontanés."
        />
      </SettingsGroup>
      <div id="notifications">
        <SettingsGroup title="Notifications">
          <UnavailableSettingRow
            title="Rappels et alertes"
            detail="Stride n’envoie pas encore de notifications."
          />
        </SettingsGroup>
      </div>
    </>
  );
}
