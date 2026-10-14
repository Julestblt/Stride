import { Button } from "@/components/ui/button";
import {
  PreferenceRow,
  PreferenceSection,
  PreviewNotificationRow,
  PreviewSegments,
  PreviewSwitch,
  SegmentedField,
  WeekdayField,
} from "@/features/settings/components/preferences";
import { SettingsNotice } from "@/features/settings/components/settings-notice";
import { requireAthlete } from "@/server/app/session";
import { readProfile } from "@/server/onboarding/profile";
import {
  addSettingsUnavailability,
  removeSettingsUnavailability,
  saveSettingsPlanning,
  saveSettingsTraining,
} from "@/server/settings/actions";
import {
  PlanningSection,
  UnavailabilitySection,
} from "@/features/settings/components/planning-sections";
import { localToday } from "@/features/plans/constraints";
import { currentPeriods } from "@/features/settings/planning";
import { readPlanningConstraints } from "@/server/plans/constraints";

const weekdays = [
  { value: 1, short: "L", label: "Lundi" },
  { value: 2, short: "M", label: "Mardi" },
  { value: 3, short: "M", label: "Mercredi" },
  { value: 4, short: "J", label: "Jeudi" },
  { value: 5, short: "V", label: "Vendredi" },
  { value: 6, short: "S", label: "Samedi" },
  { value: 7, short: "D", label: "Dimanche" },
];
const access = [
  { value: "hills", label: "Dénivelé" },
  { value: "incline_treadmill", label: "Tapis · jusqu’à 12 %" },
  { value: "gym", label: "Salle" },
  { value: "track", label: "Piste" },
];
const notifications = [
  { label: "Rappel de séance", hint: "Le matin d’une séance, 07:00" },
  {
    label: "Un changement du plan t’attend",
    hint: "Quand une proposition est en attente",
  },
  {
    label: "Alertes de récupération",
    hint: "Deux nuits de VFC basse d’affilée, FC au repos inhabituelle",
  },
  {
    label: "Préparation de course",
    hint: "Séances clés, check du matériel, début de l’affûtage",
  },
  { label: "Bilan hebdo", hint: "Dimanche soir" },
];

export default async function TrainingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const [profile, planning] = await Promise.all([
    readProfile(context),
    readPlanningConstraints(context),
  ]);
  const values = profile.values;
  return (
    <div className="flex flex-col gap-6 md:gap-10">
      <div className="flex flex-col gap-2 px-1 md:px-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:tracking-[-0.025em]">
          Entraînement et coach
        </h1>
        <p className="text-sm leading-normal text-muted md:text-body">
          Ça guide mes plans et ma façon de te parler. Changer tes
          disponibilités déclenchera une proposition de mise à jour, sans
          réécrire ta semaine en douce.
        </p>
      </div>
      <SettingsNotice status={query.status} />
      <form action={saveSettingsTraining} className="flex flex-col gap-6">
        <input type="hidden" name="revision" value={profile.revision ?? ""} />
        <PreferenceSection title="Entraînement">
          <PreferenceRow labelId="t-type" label="Discipline principale">
            <SegmentedField
              name="primary_terrain"
              labelledBy="t-type"
              stretch
              selected={values.primary_terrain ? [values.primary_terrain] : []}
              options={[
                { value: "road", label: "Route" },
                { value: "trail", label: "Trail" },
                { value: "mixed", label: "Les deux" },
              ]}
            />
          </PreferenceRow>
          <PreferenceRow
            labelId="t-days"
            label="Jours de course"
            hint="5 max par semaine"
          >
            <WeekdayField
              name="available_weekdays"
              labelledBy="t-days"
              days={weekdays}
              selected={values.available_weekdays ?? []}
            />
          </PreferenceRow>
          <PreferenceRow labelId="t-long" label="Jour de la sortie longue">
            <SegmentedField
              name="long_run_day"
              labelledBy="t-long"
              stretch
              selected={values.long_run_day ? [values.long_run_day] : []}
              options={[
                { value: "saturday", label: "Samedi" },
                { value: "sunday", label: "Dimanche" },
                { value: "flexible", label: "Flexible" },
              ]}
            />
          </PreferenceRow>
          <PreferenceRow labelId="t-time" label="Durée en semaine">
            <SegmentedField
              name="weekday_session_minutes"
              labelledBy="t-time"
              stretch
              selected={
                values.weekday_session_minutes
                  ? [String(values.weekday_session_minutes)]
                  : []
              }
              options={[45, 60, 75, 90].map((minutes) => ({
                value: String(minutes),
                label: minutes === 90 ? "90’+" : `${minutes}’`,
              }))}
            />
          </PreferenceRow>
          <PreferenceRow labelId="t-acc" label="Accès à">
            <SegmentedField
              name="training_access"
              type="checkbox"
              labelledBy="t-acc"
              selected={values.training_access ?? []}
              options={access}
            />
          </PreferenceRow>
        </PreferenceSection>
        <Button type="submit" className="self-start">
          Enregistrer les préférences
        </Button>
      </form>
      <PlanningSection
        constraints={planning}
        revision={planning.profileRevision}
        action={saveSettingsPlanning}
      />
      <UnavailabilitySection
        periods={currentPeriods(
          planning.unavailablePeriods,
          localToday(planning.timeZone),
        )}
        addAction={addSettingsUnavailability}
        removeAction={removeSettingsUnavailability}
      />
      <PreferenceSection title="Unités">
        <PreferenceRow labelId="u-sys" label="Distance et dénivelé">
          <PreviewSegments
            labelledBy="u-sys"
            stretch
            options={["km · m", "mi · ft"]}
            selected="km · m"
          />
        </PreferenceRow>
        <PreferenceRow labelId="u-pace" label="Allure">
          <PreviewSegments
            labelledBy="u-pace"
            stretch
            options={["min/km · 4:38", "km/h · 12,9"]}
            selected="min/km · 4:38"
          />
        </PreferenceRow>
      </PreferenceSection>
      <PreferenceSection title="Coach" accent badge="Bientôt">
        <PreferenceRow labelId="c-tone" label="Ton">
          <div className="flex flex-col gap-2">
            <PreviewSegments
              labelledBy="c-tone"
              options={["Direct", "Équilibré", "Encourageant"]}
            />
            <span className="text-xs text-muted-foreground">
              « Aujourd’hui : 4 × 6. Nuit courte, jambes fraîches. »
            </span>
          </div>
        </PreferenceRow>
        <PreferenceRow labelId="c-detail" label="Niveau de détail">
          <PreviewSegments
            labelledBy="c-detail"
            options={["Court", "Standard", "Avec les chiffres"]}
          />
        </PreferenceRow>
        <PreferenceRow
          labelId="c-adapt"
          label="Changements du plan"
          hint="Rien ne change sans trace dans le journal."
        >
          <div
            role="radiogroup"
            aria-labelledby="c-adapt"
            className="flex flex-col gap-1.5"
          >
            <label className="flex items-start gap-2.5 rounded-control border border-border px-3 py-2.5 text-sm opacity-70">
              <input
                type="radio"
                name="adapt"
                disabled
                className="mt-0.75 accent-accent"
              />
              Me demander avant chaque changement
            </label>
            <label className="flex items-start gap-2.5 rounded-control border border-border px-3 py-2.5 text-sm opacity-70">
              <input
                type="radio"
                name="adapt"
                disabled
                className="mt-0.75 accent-accent"
              />
              <span className="flex flex-col gap-0.5">
                Appliquer les petits ajustements, me demander pour le reste
                <span className="text-xs text-muted-foreground">
                  Lignes droites, quelques minutes en plus ou en moins ·
                  annulable 48 h
                </span>
              </span>
            </label>
          </div>
        </PreferenceRow>
        <PreferenceRow
          labelId="c-proactive"
          label="Prendre la parole en premier"
          hint="Brief du matin, alertes de récupération, tendances repérées"
        >
          <div className="flex items-center gap-3">
            <PreviewSwitch label="Coaching proactif" />
            <span className="text-sm text-muted">Désactivé</span>
          </div>
        </PreferenceRow>
      </PreferenceSection>
      <PreferenceSection
        id="notifications"
        title="Notifications"
        badge="Bientôt"
      >
        {notifications.map((item) => (
          <PreviewNotificationRow key={item.label} {...item} />
        ))}
      </PreferenceSection>
    </div>
  );
}
