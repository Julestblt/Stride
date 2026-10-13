"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StrideMark } from "@/components/stride/stride-mark";
import { cn } from "@/lib/utils";
import {
  maskFrenchDate,
  formatFrenchDate,
  formatLongFrenchDate,
  parseFrenchDate,
} from "@/features/onboarding/dates";
import type { RacePriority, RaceValues } from "@/features/onboarding/goals";
import { parseClock, parseHoursMinutes } from "@/features/races/format";
import {
  daysUntil,
  formatKm,
  formatRaceLongDate,
  formatTarget,
} from "../goals-view";
import { RemoveRaceButton } from "./remove-race-button";
import { addSettingsRace, saveSettingsRace } from "@/server/settings/actions";

export type WizardRace = {
  id: string;
  revision: number;
  values: RaceValues;
  startTime: string | null;
  cutoffSeconds: number | null;
};

const steps = ["La course", "Ton objectif", "Effet sur le plan"] as const;
const priorities: {
  value: RacePriority;
  title: string;
  description: string;
}[] = [
  {
    value: "A",
    title: "Objectif principal",
    description: "Structure tout le plan.",
  },
  {
    value: "B",
    title: "Course importante",
    description:
      "Préparée, avec 2 à 3 jours plus légers avant et une récup après.",
  },
  {
    value: "C",
    title: "Course de préparation",
    description: "Intégrée comme une séance. Pas d’affûtage.",
  },
];

const fieldLabel =
  "flex items-center justify-between gap-2 text-meta text-muted";
const fieldInput = "h-10 bg-surface px-3 text-body md:text-body";
const segment =
  "min-h-10 flex-1 rounded-control border border-border-strong bg-surface px-3 text-sm text-muted focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-semibold aria-pressed:text-background";

function Field({
  label,
  htmlFor,
  className,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.75", className)}>
      <label htmlFor={htmlFor} className={fieldLabel}>
        <span>{label}</span>
      </label>
      {children}
      {(error || hint) && (
        <span
          className={cn(
            "text-xs",
            error ? "text-warning" : "text-muted-foreground",
          )}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol aria-label="Étapes" className="flex items-center gap-2">
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < step;
        const current = number === step;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2",
              index < steps.length - 1 && "md:flex-1",
            )}
          >
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "grid size-5.5 shrink-0 place-items-center rounded-full border-[1.5px] font-metric text-sm",
                current && "border-foreground bg-foreground text-background",
                done && "border-success text-success",
                !current &&
                  !done &&
                  "border-border-strong text-muted-foreground",
              )}
            >
              {done ? <CheckIcon className="size-3" /> : number}
            </span>
            <span
              className={cn(
                "text-meta whitespace-nowrap",
                current ? "font-semibold text-foreground" : "text-muted",
                !current && "max-md:sr-only",
              )}
            >
              {label}
            </span>
            {index < steps.length - 1 && (
              <span className="h-px w-4.5 bg-border-strong md:w-8 md:flex-none" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function RaceWizard({
  mode,
  race,
  defaultPriority,
  primaryName,
}: {
  mode: "create" | "edit";
  race?: WizardRace;
  defaultPriority: RacePriority;
  primaryName: string | null;
}) {
  const router = useRouter();
  const close = () => router.push("/settings/goals");
  const values = race?.values;
  const [step, setStep] = useState(1);
  const [attempted, setAttempted] = useState(false);
  const [name, setName] = useState(values?.name ?? "");
  const [dateText, setDateText] = useState(
    formatFrenchDate(values?.race_date ?? null),
  );
  const [start, setStart] = useState(race?.startTime ?? "");
  const [distance, setDistance] = useState(
    values?.distance_km === null || values?.distance_km === undefined
      ? ""
      : String(values.distance_km).replace(".", ","),
  );
  const [elevation, setElevation] = useState(
    values?.elevation_gain_m === null || values?.elevation_gain_m === undefined
      ? ""
      : String(values.elevation_gain_m),
  );
  const [cutoff, setCutoff] = useState(
    race?.cutoffSeconds ? formatTarget(race.cutoffSeconds) : "",
  );
  const [kind, setKind] = useState(values?.race_kind ?? "trail");
  const [priority, setPriority] = useState<RacePriority>(
    values?.priority ?? defaultPriority,
  );
  const [target, setTarget] = useState(
    values?.target_duration_seconds
      ? formatTarget(values.target_duration_seconds)
      : "",
  );

  const isoDate = parseFrenchDate(dateText);
  const distanceKm = Number(distance.replace(/\s/g, "").replace(",", "."));
  const elevationM = elevation.trim() === "" ? null : Number(elevation);
  const startMinutes = start.trim() === "" ? null : parseClock(start);
  const cutoffSeconds = cutoff.trim() === "" ? null : parseHoursMinutes(cutoff);
  const targetSeconds = target.trim() === "" ? null : parseHoursMinutes(target);
  const errors = {
    name: name.trim() ? null : "Donne un nom à la course.",
    date: isoDate ? null : "Date attendue au format JJ/MM/AAAA.",
    start:
      start.trim() === "" || startMinutes !== null
        ? null
        : "Utilise le format 05:30.",
    distance:
      distance.trim() !== "" && distanceKm > 0 && distanceKm <= 1000
        ? null
        : "Indique une distance en kilomètres.",
    elevation:
      elevationM === null ||
      (Number.isInteger(elevationM) && elevationM >= 0 && elevationM <= 30000)
        ? null
        : "Indique un dénivelé en mètres.",
    cutoff:
      cutoff.trim() === "" || cutoffSeconds !== null
        ? null
        : "Utilise le format 9h00.",
    target:
      target.trim() === "" || targetSeconds !== null
        ? null
        : "Utilise le format 18h30.",
  };
  const stepOneValid = !(
    errors.name ||
    errors.date ||
    errors.start ||
    errors.distance ||
    errors.elevation ||
    errors.cutoff
  );
  const show = (error: string | null) => (attempted ? error : null);

  function next() {
    if (step === 1 && !stepOneValid) {
      setAttempted(true);
      return;
    }
    if (step === 2 && errors.target) {
      setAttempted(true);
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  const warning =
    priority === "A" && primaryName
      ? `Tu as déjà une course A : ${primaryName}. L’objectif principal reste la plus proche.`
      : null;
  const submitLabel =
    mode === "edit" ? "Enregistrer la course" : "Ajouter la course";

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 block h-svh max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-surface-inset p-0 ring-0 md:top-12 md:left-1/2 md:h-auto md:max-h-[calc(100svh-6rem)] md:w-215 md:max-w-215 md:-translate-x-1/2 md:rounded-card md:border md:border-border-strong md:bg-popover md:shadow-2xl"
      >
        <form
          action={mode === "edit" ? saveSettingsRace : addSettingsRace}
          onSubmit={(event) => {
            if (event.target !== event.currentTarget) return;
            if (step < 3) {
              event.preventDefault();
              next();
            }
          }}
          className="flex min-h-full flex-col"
        >
          {race && (
            <>
              <input type="hidden" name="id" value={race.id} />
              <input type="hidden" name="revision" value={race.revision} />
            </>
          )}
          <input type="hidden" name="race_kind" value={kind} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="race_date" value={isoDate ?? ""} />
          <input
            type="hidden"
            name="distance_km"
            value={Number.isFinite(distanceKm) ? distanceKm : ""}
          />
          <input type="hidden" name="elevation_gain_m" value={elevation} />
          <input type="hidden" name="priority" value={priority} />
          <input
            type="hidden"
            name="target_duration"
            value={targetSeconds ? formatTarget(targetSeconds) : ""}
          />
          <input
            type="hidden"
            name="start_time"
            value={
              startMinutes === null
                ? ""
                : `${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}`
            }
          />
          <input
            type="hidden"
            name="cutoff_duration"
            value={cutoffSeconds ? formatTarget(cutoffSeconds) : ""}
          />

          <header className="flex flex-col gap-4 border-b border-border px-5 pt-3.5 pb-3.5 md:px-7 md:pt-5.5 md:pb-4.5">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                className="-ml-1.5 text-muted md:hidden"
              >
                Annuler
              </Button>
              <DialogTitle className="flex-1 text-center text-body font-semibold md:flex-none md:text-left md:text-[1.375rem] md:tracking-tight">
                {mode === "edit" ? "Modifier la course" : "Ajouter une course"}
              </DialogTitle>
              <span className="min-w-14 text-right font-mono text-micro tracking-wider text-muted-foreground uppercase md:ml-auto">
                <span className="md:hidden">{step} / 3</span>
                <span className="hidden md:inline">Étape {step} sur 3</span>
              </span>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="hidden md:inline-flex"
                >
                  <XIcon />
                  <span className="sr-only">Fermer</span>
                </Button>
              </DialogPrimitive.Close>
            </div>
            <Stepper step={step} />
          </header>
          <DialogDescription className="sr-only">
            Renseigne la course, ton objectif, puis vérifie son effet sur le
            plan.
          </DialogDescription>

          <div className="flex flex-1 flex-col gap-6 px-5 py-5 md:px-7 md:py-6">
            <h1 className="text-2xl font-semibold tracking-tight md:hidden">
              {steps[step - 1]}
            </h1>

            {step === 1 && (
              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="font-mono text-micro tracking-wider text-muted uppercase">
                    Détails
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Tout reste modifiable après l’ajout
                  </span>
                </div>
                <div className="grid gap-3.5 md:grid-cols-4">
                  <Field
                    label="Nom"
                    htmlFor="race-name"
                    className="md:col-span-2"
                    error={show(errors.name)}
                  >
                    <Input
                      id="race-name"
                      value={name}
                      maxLength={120}
                      onChange={(event) => setName(event.target.value)}
                      className={fieldInput}
                    />
                  </Field>
                  <Field
                    label="Date"
                    htmlFor="race-date"
                    error={show(errors.date)}
                    hint={
                      isoDate ? formatLongFrenchDate(isoDate) : "JJ/MM/AAAA"
                    }
                  >
                    <Input
                      id="race-date"
                      inputMode="numeric"
                      placeholder="JJ/MM/AAAA"
                      value={dateText}
                      onChange={(event) =>
                        setDateText(maskFrenchDate(event.target.value))
                      }
                      className={fieldInput}
                    />
                  </Field>
                  <Field
                    label="Départ"
                    htmlFor="race-start"
                    error={show(errors.start)}
                    hint="Facultatif"
                  >
                    <Input
                      id="race-start"
                      inputMode="numeric"
                      placeholder="05:30"
                      value={start}
                      onChange={(event) => setStart(event.target.value)}
                      className={fieldInput}
                    />
                  </Field>
                  <Field
                    label="Distance"
                    htmlFor="race-distance"
                    error={show(errors.distance)}
                  >
                    <span className="relative block">
                      <Input
                        id="race-distance"
                        inputMode="decimal"
                        value={distance}
                        onChange={(event) => setDistance(event.target.value)}
                        className={cn(fieldInput, "pr-10")}
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-meta text-muted-foreground">
                        km
                      </span>
                    </span>
                  </Field>
                  <Field
                    label="D+"
                    htmlFor="race-elevation"
                    error={show(errors.elevation)}
                  >
                    <span className="relative block">
                      <Input
                        id="race-elevation"
                        inputMode="numeric"
                        value={elevation}
                        onChange={(event) => setElevation(event.target.value)}
                        className={cn(fieldInput, "pr-8")}
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-meta text-muted-foreground">
                        m
                      </span>
                    </span>
                  </Field>
                  <Field
                    label="Barrière horaire"
                    htmlFor="race-cutoff"
                    error={show(errors.cutoff)}
                    hint="Facultatif"
                  >
                    <Input
                      id="race-cutoff"
                      placeholder="9h00"
                      value={cutoff}
                      onChange={(event) => setCutoff(event.target.value)}
                      className={fieldInput}
                    />
                  </Field>
                  <div className="flex min-w-0 flex-col gap-1.75">
                    <span id="race-kind" className={fieldLabel}>
                      Type
                    </span>
                    <div
                      role="group"
                      aria-labelledby="race-kind"
                      className="flex gap-1.5"
                    >
                      {(["road", "trail"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={kind === option}
                          onClick={() => setKind(option)}
                          className={segment}
                        >
                          {option === "road" ? "Route" : "Trail"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {step === 2 && (
              <>
                <section className="flex flex-col gap-2.5">
                  <span
                    id="race-priority"
                    className="font-mono text-micro tracking-wider text-muted uppercase"
                  >
                    Priorité
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="race-priority"
                    className="grid gap-2 md:grid-cols-3"
                  >
                    {priorities.map((option) => {
                      const selected = priority === option.value;
                      const description =
                        option.value === "A" && primaryName
                          ? `Structure tout le plan. Tu en as déjà une : ${primaryName}.`
                          : option.description;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setPriority(option.value)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-surface border border-border-strong bg-surface p-3.5 text-left focus-visible:outline-2 focus-visible:outline-ring",
                            selected &&
                              "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-7.5 shrink-0 place-items-center rounded-control font-metric text-base font-bold",
                              option.value === "A" &&
                                "bg-accent text-background",
                              option.value === "B" &&
                                "border-[1.5px] border-foreground text-foreground",
                              option.value === "C" &&
                                "border-[1.5px] border-border-strong text-muted",
                            )}
                          >
                            {option.value}
                          </span>
                          <span className="flex flex-1 flex-col gap-0.75">
                            <span className="text-body font-semibold">
                              {option.title}
                            </span>
                            <span className="text-meta leading-snug text-muted-foreground">
                              {description}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                              selected
                                ? "border-foreground"
                                : "border-border-strong",
                            )}
                          >
                            {selected && (
                              <span className="size-2 rounded-full bg-foreground" />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {warning && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                      {warning}
                    </p>
                  )}
                </section>
                <section className="max-w-sm">
                  <Field
                    label="Temps visé · facultatif"
                    htmlFor="race-target"
                    error={show(errors.target)}
                    hint="Format 18h30. Tu pourras l’ajuster depuis le plan de course."
                  >
                    <Input
                      id="race-target"
                      placeholder="18h30"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      className={fieldInput}
                    />
                  </Field>
                </section>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-start gap-2.5 rounded-surface border border-border bg-surface px-4 py-3.5">
                  <StrideMark className="mt-0.5 size-3.5 shrink-0" />
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-semibold">
                      Aucun plan n’est défini pour l’instant.
                    </p>
                    <p className="text-sm leading-relaxed text-muted">
                      Cette course est ajoutée à tes objectifs sans modifier
                      aucune semaine. Quand tu auras un plan, Stride s’appuiera
                      sur elle pour le construire et te proposera les
                      ajustements à relire avant de les appliquer.
                    </p>
                  </div>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-4">
                  {[
                    {
                      label: name || "Course",
                      value:
                        priority === "A" ? "Course A" : `Course ${priority}`,
                    },
                    {
                      label: formatRaceLongDate(isoDate ?? null),
                      value: isoDate
                        ? `${daysUntil(isoDate, new Date().toISOString().slice(0, 10))} jours`
                        : "—",
                    },
                    {
                      label: "Distance",
                      value: formatKm(
                        Number.isFinite(distanceKm) ? distanceKm : null,
                      ),
                    },
                    {
                      label: "Temps visé",
                      value: targetSeconds ? formatTarget(targetSeconds) : "—",
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-0.5">
                      <dd className="font-metric text-2xl leading-none font-semibold tabular-nums">
                        {item.value}
                      </dd>
                      <dt className="text-xs text-muted-foreground">
                        {item.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>

          <footer className="sticky bottom-0 flex items-center gap-2.5 border-t border-border bg-surface-inset px-5 py-4 md:bg-popover md:px-7">
            {step === 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                className="text-muted max-md:hidden"
              >
                Annuler
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(step - 1)}
                className="text-muted"
              >
                Retour
              </Button>
            )}
            {mode === "edit" && race && step === 1 && (
              <RemoveRaceButton
                id={race.id}
                name={race.values.name ?? "cette course"}
              />
            )}
            <span className="ml-auto" />
            {step < 3 ? (
              <Button type="button" onClick={next}>
                {step === 2 ? "Voir l’effet sur le plan" : "Continuer"}
              </Button>
            ) : (
              <Button type="submit">{submitLabel}</Button>
            )}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
