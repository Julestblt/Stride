"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SourceMark } from "@/components/stride/marks";
import {
  formatFrenchDate,
  maskFrenchDate,
  parseFrenchDate,
} from "@/features/onboarding/dates";
import { cn } from "@/lib/utils";
import { createShoe, updateShoe } from "@/server/gear/actions";
import { gearErrorMessage, parseKm, parseOptionalNumber } from "../form";
import {
  categoryLabels,
  defaultLifespanKm,
  defaultTerrain,
  garminDefaultLabels,
  garminDefaults,
  plateLabels,
  shoeCategories,
  shoePlates,
  shoeTerrains,
  terrainLabels,
  type GarminDefault,
  type ShoeCategory,
  type ShoePlate,
  type ShoeSpec,
  type ShoeTerrain,
} from "../model";

type Draft = {
  brand: string;
  model: string;
  version: string;
  category: ShoeCategory;
  terrain: ShoeTerrain;
  foam: string;
  stackHeelMm: string;
  stackForefootMm: string;
  dropMm: string;
  weightG: string;
  plate: ShoePlate | null;
  lugDepthMm: string;
  sizeEu: string;
  lifespanKm: string;
  notes: string;
};

const numberText = (value: number | null) =>
  value === null ? "" : new Intl.NumberFormat("fr-FR").format(value);

function draftOf(spec: ShoeSpec | null): Draft {
  return {
    brand: spec?.brand ?? "",
    model: spec?.model ?? "",
    version: spec?.version ?? "",
    category: spec?.category ?? "daily",
    terrain: spec?.terrain ?? "road",
    foam: spec?.foam ?? "",
    stackHeelMm: numberText(spec?.stackHeelMm ?? null),
    stackForefootMm: numberText(spec?.stackForefootMm ?? null),
    dropMm: numberText(spec?.dropMm ?? null),
    weightG: numberText(spec?.weightG ?? null),
    plate: spec?.plate ?? null,
    lugDepthMm: numberText(spec?.lugDepthMm ?? null),
    sizeEu: numberText(spec?.sizeEu ?? null),
    lifespanKm: String(spec?.lifespanKm ?? defaultLifespanKm.daily),
    notes: spec?.notes ?? "",
  };
}

type SpecResult = { spec: ShoeSpec } | { errors: (keyof Draft)[] };

function specOf(draft: Draft): SpecResult {
  const errors: (keyof Draft)[] = [];
  const optional = (key: keyof Draft, min: number, max: number) => {
    const value = parseOptionalNumber(String(draft[key] ?? ""), min, max);
    if (value === undefined) errors.push(key);
    return value ?? null;
  };
  const lifespan = parseOptionalNumber(draft.lifespanKm, 100, 3000);
  if (!draft.brand.trim()) errors.push("brand");
  if (!draft.model.trim()) errors.push("model");
  if (lifespan === undefined || lifespan === null) errors.push("lifespanKm");
  const spec = {
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    version: draft.version.trim() || null,
    category: draft.category,
    terrain: draft.terrain,
    foam: draft.foam.trim() || null,
    stackHeelMm: optional("stackHeelMm", 5, 60),
    stackForefootMm: optional("stackForefootMm", 5, 60),
    dropMm: optional("dropMm", 0, 20),
    weightG: optional("weightG", 80, 600),
    plate: draft.plate,
    lugDepthMm: optional("lugDepthMm", 0, 10),
    sizeEu: optional("sizeEu", 30, 52),
    lifespanKm: Math.round(lifespan ?? 0),
    notes: draft.notes.trim() || null,
  };
  if (spec.weightG !== null) spec.weightG = Math.round(spec.weightG);
  return errors.length ? { errors } : { spec };
}

function Chips<T extends string>({
  legend,
  options,
  value,
  labels,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  value: T | null;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-meta text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="relative cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={name}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="inline-flex min-h-10 items-center rounded-control border border-border-strong px-3 text-sm text-muted peer-checked:border-foreground peer-checked:bg-foreground peer-checked:font-semibold peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
              {labels[option]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TextField({
  id,
  label,
  value,
  invalid,
  onChange,
  placeholder,
  inputMode,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  suffix?: string;
}) {
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          value={value}
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className={cn(suffix && "pr-12")}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

export function ShoeForm({
  mode,
  id,
  spec = null,
  today,
}: {
  mode: "create" | "edit";
  id?: string;
  spec?: ShoeSpec | null;
  today: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(spec));
  const [lifespanTouched, setLifespanTouched] = useState(mode === "edit");
  const [worn, setWorn] = useState(false);
  const [currentKm, setCurrentKm] = useState("");
  const [firstUse, setFirstUse] = useState(formatFrenchDate(today));
  const [garminDefault, setGarminDefault] = useState<GarminDefault>("none");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => current.filter((error) => error !== key));
  };
  const chooseCategory = (category: ShoeCategory) => {
    setDraft((current) => ({
      ...current,
      category,
      terrain: mode === "create" ? defaultTerrain[category] : current.terrain,
      lifespanKm: lifespanTouched
        ? current.lifespanKm
        : String(defaultLifespanKm[category]),
    }));
    if (mode === "create")
      setGarminDefault(category === "trail" ? "trail_running" : garminDefault);
  };
  const invalid = (key: string) => errors.includes(key);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const result = specOf(draft);
    const nextErrors: string[] = "errors" in result ? [...result.errors] : [];
    const firstUseDate = parseFrenchDate(firstUse);
    const km = worn ? parseKm(currentKm) : 0;
    if (mode === "create") {
      if (!firstUseDate || firstUseDate > today) nextErrors.push("firstUse");
      if (km === null) nextErrors.push("currentKm");
    }
    if (nextErrors.length || !("spec" in result)) {
      setErrors(nextErrors);
      setMessage("Vérifie les champs en rouge.");
      return;
    }
    startTransition(async () => {
      const response =
        mode === "create"
          ? await createShoe({
              spec: result.spec,
              currentKm: km ?? 0,
              firstUseDate,
              garminDefault,
            })
          : await updateShoe({ id, spec: result.spec });
      if (response.status === "saved" && response.id)
        router.push(`/gear/${response.id}`);
      else setMessage(gearErrorMessage(response));
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <section className="flex flex-col gap-4.5 rounded-panel border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lead font-semibold">La paire</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.4fr_0.6fr]">
          <TextField
            id="shoe-brand"
            label="Marque"
            value={draft.brand}
            invalid={invalid("brand")}
            placeholder="HOKA"
            onChange={(value) => set("brand", value)}
          />
          <TextField
            id="shoe-model"
            label="Modèle"
            value={draft.model}
            invalid={invalid("model")}
            placeholder="Speedgoat"
            onChange={(value) => set("model", value)}
          />
          <TextField
            id="shoe-version"
            label="Version"
            value={draft.version}
            placeholder="7"
            onChange={(value) => set("version", value)}
          />
        </div>
        <Chips
          legend="Catégorie"
          options={shoeCategories}
          value={draft.category}
          labels={categoryLabels}
          onChange={chooseCategory}
        />
        <Chips
          legend="Terrain"
          options={shoeTerrains}
          value={draft.terrain}
          labels={terrainLabels}
          onChange={(value) => set("terrain", value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field data-invalid={invalid("lifespanKm") || undefined}>
            <FieldLabel
              htmlFor="shoe-lifespan"
              className="flex items-center gap-2"
            >
              Durée de vie
              {!lifespanTouched && (
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <SourceMark source="estimate" />
                  réglage Stride pour la catégorie
                </span>
              )}
            </FieldLabel>
            <div className="relative">
              <Input
                id="shoe-lifespan"
                inputMode="numeric"
                autoComplete="off"
                value={draft.lifespanKm}
                aria-invalid={invalid("lifespanKm") || undefined}
                className="pr-12"
                onChange={(event) => {
                  setLifespanTouched(true);
                  set("lifespanKm", event.target.value);
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                km
              </span>
            </div>
            <FieldDescription>Garmin te prévient à ce total.</FieldDescription>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4.5 rounded-panel border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="text-lead font-semibold">Fiche technique</h2>
          <span className="text-xs text-muted-foreground">
            facultative, elle affine les conseils de Stride
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            id="shoe-foam"
            label="Mousse"
            value={draft.foam}
            onChange={(value) => set("foam", value)}
          />
          <TextField
            id="shoe-heel"
            label="Hauteur au talon"
            value={draft.stackHeelMm}
            inputMode="decimal"
            suffix="mm"
            invalid={invalid("stackHeelMm")}
            onChange={(value) => set("stackHeelMm", value)}
          />
          <TextField
            id="shoe-forefoot"
            label="Hauteur à l’avant-pied"
            value={draft.stackForefootMm}
            inputMode="decimal"
            suffix="mm"
            invalid={invalid("stackForefootMm")}
            onChange={(value) => set("stackForefootMm", value)}
          />
          <TextField
            id="shoe-drop"
            label="Drop"
            value={draft.dropMm}
            inputMode="decimal"
            suffix="mm"
            invalid={invalid("dropMm")}
            onChange={(value) => set("dropMm", value)}
          />
          <TextField
            id="shoe-weight"
            label="Poids"
            value={draft.weightG}
            inputMode="numeric"
            suffix="g"
            invalid={invalid("weightG")}
            onChange={(value) => set("weightG", value)}
          />
          <TextField
            id="shoe-size"
            label="Pointure"
            value={draft.sizeEu}
            inputMode="decimal"
            suffix="EU"
            invalid={invalid("sizeEu")}
            onChange={(value) => set("sizeEu", value)}
          />
          <TextField
            id="shoe-lugs"
            label="Profondeur des crampons"
            value={draft.lugDepthMm}
            inputMode="decimal"
            suffix="mm"
            invalid={invalid("lugDepthMm")}
            onChange={(value) => set("lugDepthMm", value)}
          />
        </div>
        <Chips
          legend="Plaque"
          options={shoePlates}
          value={draft.plate}
          labels={plateLabels}
          onChange={(value) => set("plate", value)}
        />
      </section>

      {mode === "create" && (
        <section className="flex flex-col gap-4.5 rounded-panel border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lead font-semibold">Kilomètres</h2>
          <Chips
            legend="Cette paire a-t-elle déjà couru ?"
            options={["new", "worn"] as const}
            value={worn ? "worn" : "new"}
            labels={{ new: "Neuve · 0 km", worn: "Déjà portée" }}
            onChange={(value) => setWorn(value === "worn")}
          />
          {worn && (
            <div className="max-w-80">
              <TextField
                id="shoe-current-km"
                label="Total actuel"
                value={currentKm}
                inputMode="decimal"
                suffix="km"
                invalid={invalid("currentKm")}
                onChange={(value) => {
                  setCurrentKm(value);
                  setErrors((current) =>
                    current.filter((error) => error !== "currentKm"),
                  );
                }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Déjà portée : saisis son total actuel, par exemple celui de Strava.
            Stride le garde comme km de départ, puis Garmin compte la suite.
          </p>
          <Field
            data-invalid={invalid("firstUse") || undefined}
            className="max-w-80"
          >
            <FieldLabel htmlFor="shoe-first-use">
              Première sortie avec
            </FieldLabel>
            <Input
              id="shoe-first-use"
              inputMode="numeric"
              autoComplete="off"
              placeholder="JJ/MM/AAAA"
              value={firstUse}
              aria-invalid={invalid("firstUse") || undefined}
              onChange={(event) => {
                setFirstUse(maskFrenchDate(event.target.value));
                setErrors((current) =>
                  current.filter((error) => error !== "firstUse"),
                );
              }}
            />
            <FieldDescription>
              Garmin ne lie la paire qu’aux sorties faites à partir de cette
              date.
            </FieldDescription>
          </Field>
        </section>
      )}

      {mode === "create" && (
        <section className="flex flex-col gap-3.5 rounded-panel border border-border bg-surface p-5 sm:p-6">
          <h2 className="flex items-center gap-2.5 text-lead font-semibold">
            <SourceMark source="provider" />
            Dans Garmin
          </h2>
          <p className="text-sm leading-normal text-muted">
            Stride crée la paire dans Garmin Connect. Garmin comptera ensuite
            chaque sortie et te préviendra quand elle atteindra sa durée de vie.
          </p>
          <Chips
            legend="Paire par défaut dans Garmin pour"
            options={garminDefaults}
            value={garminDefault}
            labels={garminDefaultLabels}
            onChange={setGarminDefault}
          />
        </section>
      )}

      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => router.back()}
        >
          Annuler
        </Button>
        <Button type="submit" size="md" disabled={pending}>
          {mode === "create"
            ? pending
              ? "Création dans Garmin…"
              : "Enregistrer et créer dans Garmin"
            : pending
              ? "Enregistrement…"
              : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
