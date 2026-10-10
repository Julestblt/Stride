"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SaveRequest } from "@/features/onboarding/autosave";
import type {
  KnownValue,
  ProfileSuggestions,
} from "@/features/onboarding/known-values";
import {
  answeredCount,
  cachedProfileFields,
  missingRequiredFields,
  profileFields,
  type ProfileField,
  type ProfileSnapshot,
  type ProfileValues,
  type ValueSource,
} from "@/features/onboarding/profile";
import { cn } from "@/lib/utils";
import {
  completeOnboarding,
  saveAthleteProfile,
} from "@/server/onboarding/actions";
import {
  AccessField,
  ChoiceField,
  DateField,
  DaysField,
  KnownPanel,
  NumberField,
  SaveIndicator,
  SectionLabel,
  StrideNote,
  TextField,
} from "./about-fields";
import { OnboardingActions } from "./onboarding-actions";
import { useAutosave, type AutosaveResult } from "./use-autosave";
import { useOnboardingTransition } from "./use-onboarding-transition";

type Values = Omit<ProfileValues, "value_sources">;
type Sources = ProfileValues["value_sources"];

const labels: Record<ProfileField, string> = {
  first_name: "Prénom",
  birth_date: "Date de naissance",
  sex: "Sexe pour les estimations",
  height_cm: "Taille",
  weight_kg: "Poids",
  primary_terrain: "Terrain principal",
  available_weekdays: "Jours où tu peux courir",
  long_run_day: "Jour de sortie longue",
  weekday_session_minutes: "Temps en semaine",
  training_access: "Accès",
};
const groups: { title: string; fields: ProfileField[] }[] = [
  { title: "Faisons connaissance", fields: ["first_name", "birth_date"] },
  {
    title: "Pour tes estimations",
    fields: ["sex", "height_cm", "weight_kg"],
  },
  {
    title: "Quels jours peux-tu courir ?",
    fields: ["available_weekdays", "long_run_day"],
  },
  {
    title: "Ton terrain et ton temps",
    fields: ["primary_terrain", "weekday_session_minutes"],
  },
  { title: "Tu as accès à…", fields: ["training_access"] },
];

function split(values: ProfileValues): { values: Values; sources: Sources } {
  const { value_sources, ...rest } = values;
  return { values: rest, sources: value_sources };
}

export function AboutStep({
  userId,
  revision,
  profile,
  updatedAt,
  known,
  suggestions,
}: {
  userId: string;
  revision: number;
  profile: ProfileSnapshot;
  updatedAt: string | null;
  known: KnownValue[];
  suggestions: ProfileSuggestions;
}) {
  const initial = split(profile.values);
  const [sources, setSources] = useState<Sources>(initial.sources);
  const sourcesRef = useRef(sources);
  const garmin = useRef(new Set<ProfileField>());
  const completion = useOnboardingTransition();
  const [group, setGroup] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const save = useCallback(
    async (request: SaveRequest<Values>): Promise<AutosaveResult<Values>> => {
      const changed = Object.keys(request.values) as ProfileField[];
      const result = await saveAthleteProfile({
        values: request.values,
        sources: Object.fromEntries(
          changed.map((field): [ProfileField, ValueSource] => [
            field,
            garmin.current.has(field)
              ? { source: "garmin", observed_on: suggestions.observedOn }
              : { source: "athlete" },
          ]),
        ),
        revision: request.revision,
      });
      if (result.status === "saved" || result.status === "conflict") {
        const next = split(result.snapshot.values);
        sourcesRef.current = next.sources;
        setSources(next.sources);
        return {
          status: result.status,
          snapshot: { values: next.values, revision: result.snapshot.revision },
        };
      }
      return result;
    },
    [suggestions.observedOn],
  );
  const autosave = useAutosave<Values>({
    initial: { values: initial.values, revision: profile.revision },
    save,
    cacheKey: `stride:onboarding:about:${userId}`,
    cacheFields: cachedProfileFields,
    serverUpdatedAt: updatedAt,
  });
  const { change, flush, resolve, state } = autosave;
  const local = state.local;
  const set = <K extends keyof Values>(
    field: K,
    value: Values[K],
    timing: "debounce" | "now" = "now",
  ) => {
    garmin.current.delete(field);
    setNotice(null);
    change(field, value, timing);
  };
  const suggested = useRef(false);
  useEffect(() => {
    if (suggested.current) return;
    suggested.current = true;
    const apply = <K extends "available_weekdays" | "primary_terrain">(
      field: K,
      value: Values[K] | undefined,
    ) => {
      if (
        value === undefined ||
        local[field] !== null ||
        sourcesRef.current[field]?.source === "athlete"
      )
        return;
      garmin.current.add(field);
      change(field, value, "now");
    };
    apply("available_weekdays", suggestions.available_weekdays);
    apply("primary_terrain", suggestions.primary_terrain?.value);
  }, [change, local, suggestions]);
  const fromGarmin = (field: ProfileField) =>
    garmin.current.has(field) ||
    (sources[field]?.source === "garmin" && !state.dirty.includes(field));
  const visible = (index: number) => cn(index !== group && "max-lg:hidden");
  async function next() {
    if (group < groups.length - 1) {
      setGroup(group + 1);
      void flush();
      return;
    }
    await finish();
  }
  async function finish() {
    setNotice(null);
    const saved = await flush();
    if (!saved) {
      setNotice("Enregistre tes réponses avant de continuer.");
      return;
    }
    const missing = missingRequiredFields({ ...local, value_sources: sources });
    if (missing.length > 0) {
      setNotice(
        `Il manque encore : ${missing.map((field) => labels[field].toLowerCase()).join(", ")}.`,
      );
      setGroup(
        Math.max(
          0,
          groups.findIndex((item) =>
            item.fields.some((field) => missing.includes(field)),
          ),
        ),
      );
      return;
    }
    completion.run(
      () => completeOnboarding({ step: "about", revision }),
      "L’enregistrement a échoué. Réessaie dans un instant.",
    );
  }
  const answered = answeredCount({ ...local, value_sources: sources });
  return (
    <div className="flex flex-1 flex-col gap-7 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-12">
      <div className="flex flex-1 flex-col gap-6 motion-safe:animate-rise lg:gap-8">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-micro text-muted-foreground uppercase lg:hidden">
            À propos de toi · {group + 1}/{groups.length}
          </p>
          <h1 className="text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
            <span className="lg:hidden">{groups[group].title}</span>
            <span className="hidden lg:inline">
              Quelques infos que Garmin ne me donne pas.
            </span>
          </h1>
          <p className="hidden text-lead text-pretty text-muted lg:block">
            Le reste, je le déduis de ton historique. Tu pourras tout modifier
            plus tard.
          </p>
        </div>
        {state.conflicts.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-surface border border-warning-border bg-surface p-4"
          >
            <p className="text-sm font-semibold">
              Tes réponses ont changé sur un autre appareil.
            </p>
            {state.conflicts.map((field) => (
              <div
                key={field}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{labels[field as ProfileField]}</span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolve(field, "mine")}
                  >
                    Garder ma réponse
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resolve(field, "theirs");
                      setResetKey((key) => key + 1);
                    }}
                  >
                    Reprendre l’autre
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div key={resetKey} className="flex flex-col gap-6 lg:gap-8">
          <section className="flex flex-col gap-5">
            <SectionLabel>Toi</SectionLabel>
            <div className={cn("grid gap-5 lg:grid-cols-2", visible(0))}>
              <TextField
                id="first-name"
                label="Prénom"
                autoComplete="given-name"
                value={local.first_name}
                onCommit={(value) => set("first_name", value, "debounce")}
              />
              <DateField
                id="birth-date"
                label="Date de naissance"
                autoComplete="bday"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
                value={local.birth_date}
                onCommit={(value) => set("birth_date", value, "debounce")}
              />
            </div>
            <div className={cn("flex flex-col gap-5", visible(1))}>
              <ChoiceField
                label="Sexe pour les estimations physiologiques"
                value={local.sex}
                options={[
                  { value: "female", label: "Femme" },
                  { value: "male", label: "Homme" },
                  { value: "unspecified", label: "Non précisé" },
                ]}
                onChange={(value) => set("sex", value)}
                description={
                  <p className="text-xs text-muted-foreground">
                    Sert uniquement à estimer ta FC max et tes besoins
                    énergétiques.
                  </p>
                }
              />
              <div className="grid grid-cols-2 gap-5">
                <NumberField
                  id="height"
                  label="Taille"
                  unit="cm"
                  min={100}
                  max={250}
                  value={local.height_cm}
                  onCommit={(value) => set("height_cm", value, "debounce")}
                />
                <NumberField
                  id="weight"
                  label="Poids"
                  unit="kg"
                  min={25}
                  max={250}
                  value={local.weight_kg}
                  onCommit={(value) => set("weight_kg", value, "debounce")}
                />
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-5 lg:border-t lg:border-border lg:pt-8">
            <SectionLabel>Ta façon de t’entraîner</SectionLabel>
            <div className={cn("flex flex-col gap-5", visible(2))}>
              <DaysField
                value={local.available_weekdays}
                onChange={(value) => set("available_weekdays", value)}
                description={
                  fromGarmin("available_weekdays") && (
                    <StrideNote>
                      Présélection d’après tes 12 derniers mois. Ajuste si ta
                      semaine a changé.
                    </StrideNote>
                  )
                }
              />
              <ChoiceField
                label="Jour de sortie longue"
                value={local.long_run_day}
                options={[
                  { value: "saturday", label: "Samedi" },
                  { value: "sunday", label: "Dimanche" },
                  { value: "flexible", label: "Flexible" },
                ]}
                onChange={(value) => set("long_run_day", value)}
              />
            </div>
            <div className={cn("flex flex-col gap-5", visible(3))}>
              <ChoiceField
                label="Surtout…"
                value={local.primary_terrain}
                options={[
                  { value: "road", label: "Route" },
                  { value: "trail", label: "Trail" },
                  { value: "mixed", label: "Les deux" },
                ]}
                onChange={(value) => set("primary_terrain", value)}
                description={
                  suggestions.primary_terrain && (
                    <StrideNote>
                      Suggestion : {suggestions.primary_terrain.note}
                    </StrideNote>
                  )
                }
              />
              <ChoiceField
                label="Temps en semaine"
                value={
                  local.weekday_session_minutes === null
                    ? null
                    : (String(local.weekday_session_minutes) as
                        "45" | "60" | "75" | "90")
                }
                options={[
                  { value: "45", label: "45'" },
                  { value: "60", label: "60'" },
                  { value: "75", label: "75'" },
                  { value: "90", label: "90'+" },
                ]}
                onChange={(value) =>
                  set(
                    "weekday_session_minutes",
                    value === null ? null : Number(value),
                  )
                }
              />
            </div>
            <div className={visible(4)}>
              <AccessField
                value={local.training_access}
                onChange={(value) => set("training_access", value)}
              />
            </div>
          </section>
        </div>
        <OnboardingActions className="lg:border-t lg:border-border lg:pt-8">
          {(notice || completion.message) && (
            <p role="alert" className="text-sm text-warning lg:basis-full">
              {notice ?? completion.message}
            </p>
          )}
          <div className="flex w-full gap-2.5 lg:w-auto">
            {group < groups.length - 1 && (
              <Button
                variant="outline"
                className="lg:hidden"
                onClick={() => setGroup(group + 1)}
              >
                Passer
              </Button>
            )}
            <Button
              className="flex-1 lg:hidden"
              disabled={completion.pending}
              aria-busy={completion.pending}
              onClick={() => void next()}
            >
              {group < groups.length - 1 ? "Suivant" : "Continuer"}
            </Button>
            <Button
              className="hidden lg:inline-flex lg:px-5.5"
              disabled={completion.pending}
              aria-busy={completion.pending}
              onClick={() => void finish()}
            >
              Continuer
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 lg:justify-start">
            <span className="hidden text-meta text-muted-foreground lg:inline">
              {answered}/{profileFields.length} réponses · environ une minute
            </span>
            <SaveIndicator
              status={state.status}
              onRetry={() => void autosave.retry()}
            />
          </div>
        </OnboardingActions>
      </div>
      <aside className="hidden lg:block">
        <KnownPanel known={known} />
      </aside>
    </div>
  );
}
