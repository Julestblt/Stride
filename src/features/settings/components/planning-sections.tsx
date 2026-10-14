import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanningConstraints } from "@/features/plans/constraints";
import {
  formatPeriod,
  formatWeeklyCeiling,
  maxReasonLength,
  timeZoneOptions,
  unavailabilityKindLabels,
} from "@/features/settings/planning";
import { FrenchDateInput } from "./french-date-input";
import {
  PreferenceRow,
  PreferenceSection,
  SegmentedField,
} from "./preferences";

type FormAction = (data: FormData) => Promise<void>;

export function PlanningSection({
  constraints,
  revision,
  action,
}: {
  constraints: PlanningConstraints;
  revision: number | null;
  action: FormAction;
}) {
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="revision" value={revision ?? ""} />
      <PreferenceSection title="Planification">
        <PreferenceRow
          labelId="p-zone"
          label="Fuseau horaire"
          hint="Définit ton « aujourd’hui » et les dates de ton plan."
        >
          <Select name="time_zone" defaultValue={constraints.timeZone}>
            <SelectTrigger aria-labelledby="p-zone" className="w-full md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeZoneOptions().map((zone) => (
                <SelectItem key={zone.value} value={zone.value}>
                  {zone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceRow>
        <PreferenceRow
          labelId="p-ceiling"
          label="Temps d’entraînement max"
          hint="Par semaine, toutes séances comprises. Laisse vide pour ne pas fixer de plafond."
        >
          <Input
            name="max_weekly"
            aria-labelledby="p-ceiling"
            inputMode="decimal"
            autoComplete="off"
            placeholder="ex. 6 h 30"
            defaultValue={formatWeeklyCeiling(constraints.maxWeeklyMinutes)}
            className="md:w-40"
          />
        </PreferenceRow>
      </PreferenceSection>
      <Button type="submit" className="self-start">
        Enregistrer la planification
      </Button>
    </form>
  );
}

export function UnavailabilitySection({
  periods,
  addAction,
  removeAction,
}: {
  periods: PlanningConstraints["unavailablePeriods"];
  addAction: FormAction;
  removeAction: FormAction;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PreferenceSection title="Indisponibilités">
        {periods.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted md:px-0 md:py-4">
            Aucune période à venir. Ajoute tes voyages ou tes pauses pour que
            ton plan les évite.
          </p>
        ) : (
          <ul aria-label="Périodes à venir" className="flex flex-col">
            {periods.map((period) => {
              const label = formatPeriod(period);
              return (
                <li
                  key={period.id}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 md:px-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm">{label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {unavailabilityKindLabels[period.kind]}
                      {period.reason ? ` · ${period.reason}` : ""}
                    </span>
                  </div>
                  <form action={removeAction}>
                    <input type="hidden" name="id" value={period.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Supprimer la période : ${label}`}
                    >
                      Supprimer
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </PreferenceSection>
      <form action={addAction} className="flex flex-col gap-6">
        <PreferenceSection title="Ajouter une période">
          <PreferenceRow labelId="u-dates" label="Dates">
            <div
              role="group"
              aria-labelledby="u-dates"
              className="grid grid-cols-2 gap-2 md:w-80"
            >
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Début
                <FrenchDateInput id="u-start" name="starts_on" required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Fin
                <FrenchDateInput id="u-end" name="ends_on" required />
              </label>
            </div>
          </PreferenceRow>
          <PreferenceRow labelId="u-kind" label="Type">
            <SegmentedField
              name="kind"
              labelledBy="u-kind"
              stretch
              selected={["travel"]}
              options={Object.entries(unavailabilityKindLabels).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </PreferenceRow>
          <PreferenceRow labelId="u-reason" label="Motif" hint="Facultatif">
            <Input
              name="reason"
              aria-labelledby="u-reason"
              maxLength={maxReasonLength}
              autoComplete="off"
              placeholder="ex. Congrès à Lyon"
              className="md:w-80"
            />
          </PreferenceRow>
        </PreferenceSection>
        <Button type="submit" variant="outline" className="self-start">
          Ajouter la période
        </Button>
      </form>
    </div>
  );
}
