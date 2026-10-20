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
import {
  createShoe,
  extractShoeFromLink,
  updateShoe,
  type LinkExtraction,
} from "@/server/gear/actions";
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
  specSourceFields,
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

type SourceField = (typeof specSourceFields)[number];
type Marker = "page" | "missing" | "manual" | "stride" | null;

const numberText = (value: number | null | undefined) =>
  value === null || value === undefined
    ? ""
    : new Intl.NumberFormat("fr-FR").format(value);

function draftOf(spec: ShoeSpec | null): Draft {
  return {
    brand: spec?.brand ?? "",
    model: spec?.model ?? "",
    version: spec?.version ?? "",
    category: spec?.category ?? "daily",
    terrain: spec?.terrain ?? "road",
    foam: spec?.foam ?? "",
    stackHeelMm: numberText(spec?.stackHeelMm),
    stackForefootMm: numberText(spec?.stackForefootMm),
    dropMm: numberText(spec?.dropMm),
    weightG: numberText(spec?.weightG),
    plate: spec?.plate ?? null,
    lugDepthMm: numberText(spec?.lugDepthMm),
    sizeEu: numberText(spec?.sizeEu),
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
  const weight = optional("weightG", 80, 600);
  const spec: ShoeSpec = {
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    version: draft.version.trim() || null,
    category: draft.category,
    terrain: draft.terrain,
    foam: draft.foam.trim() || null,
    stackHeelMm: optional("stackHeelMm", 5, 60),
    stackForefootMm: optional("stackForefootMm", 5, 60),
    dropMm: optional("dropMm", 0, 20),
    weightG: weight === null ? null : Math.round(weight),
    plate: draft.plate,
    lugDepthMm: optional("lugDepthMm", 0, 10),
    sizeEu: optional("sizeEu", 30, 52),
    lifespanKm: Math.round(lifespan ?? 0),
    notes: draft.notes.trim() || null,
  };
  return errors.length ? { errors } : { spec };
}

const linkMessages: Record<
  Exclude<LinkExtraction["status"], "extracted">,
  string
> = {
  "invalid-url": "Colle l’adresse complète de la page, en https.",
  blocked: "Cette adresse ne peut pas être lue par Stride.",
  unreachable: "La page ne répond pas. Vérifie le lien ou réessaie.",
  unreadable:
    "La page ne se laisse pas lire automatiquement. Essaie une autre page produit, par exemple chez un revendeur.",
  empty:
    "Aucune caractéristique trouvée sur cette page. Remplis la fiche à la main.",
  unavailable: "La lecture de la page a échoué. Réessaie dans un instant.",
  "session-expired": "Ta session a expiré. Reconnecte-toi puis réessaie.",
};

function SourceTag({ marker }: { marker: Marker }) {
  if (!marker) return null;
  const tags = {
    page: { source: "provider" as const, label: "Page produit", className: "" },
    missing: {
      source: "estimate" as const,
      label: "Absent de la page",
      className: "text-warning",
    },
    manual: { source: "manual" as const, label: "Toi", className: "" },
    stride: {
      source: "estimate" as const,
      label: "Réglage Stride",
      className: "",
    },
  }[marker];
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1.5 font-mono text-nano text-muted-foreground uppercase",
        tags.className,
      )}
    >
      <SourceMark source={tags.source} />
      {tags.label}
    </span>
  );
}

function Chips<T extends string>({
  legend,
  options,
  value,
  labels,
  marker = null,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  value: T | null;
  labels: Record<T, string>;
  marker?: Marker;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="flex w-full items-center pb-2 text-meta text-muted">
        {legend}
        <SourceTag marker={marker} />
      </legend>
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
  marker = null,
  onChange,
  placeholder,
  inputMode,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  invalid?: boolean;
  marker?: Marker;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  suffix?: string;
}) {
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id} className="flex w-full items-center">
        {label}
        <SourceTag marker={marker} />
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          value={value}
          inputMode={inputMode}
          autoComplete="off"
          placeholder={marker === "missing" ? "À compléter" : placeholder}
          aria-invalid={invalid || undefined}
          className={cn(
            suffix && "pr-12",
            marker === "missing" && "border-warning-border",
          )}
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
  withLink = false,
}: {
  mode: "create" | "edit";
  id?: string;
  spec?: ShoeSpec | null;
  today: string;
  withLink?: boolean;
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
  const [url, setUrl] = useState("");
  const [reading, startReading] = useTransition();
  const [linkStatus, setLinkStatus] = useState("");
  const [page, setPage] = useState<{
    url: string;
    fields: SourceField[];
    edited: SourceField[];
  } | null>(null);
  const showForm = !withLink || page !== null || mode === "edit";

  const marker = (key: SourceField): Marker => {
    if (!page) return null;
    if (page.edited.includes(key)) return "manual";
    return page.fields.includes(key) ? "page" : "missing";
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => current.filter((error) => error !== key));
    if (page && (specSourceFields as readonly string[]).includes(key))
      setPage((current) =>
        current && !current.edited.includes(key as SourceField)
          ? { ...current, edited: [...current.edited, key as SourceField] }
          : current,
      );
  };
  const chooseCategory = (category: ShoeCategory) => {
    set("category", category);
    setDraft((current) => ({
      ...current,
      terrain: mode === "create" ? defaultTerrain[category] : current.terrain,
      lifespanKm: lifespanTouched
        ? current.lifespanKm
        : String(defaultLifespanKm[category]),
    }));
    if (mode === "create" && category === "trail")
      setGarminDefault("trail_running");
  };
  const invalid = (key: string) => errors.includes(key);

  const read = (event: React.FormEvent) => {
    event.preventDefault();
    setLinkStatus("");
    startReading(async () => {
      const result = await extractShoeFromLink({ url });
      if (result.status !== "extracted") {
        setLinkStatus(linkMessages[result.status]);
        if (result.status === "empty")
          setPage({ url: url.trim(), fields: [], edited: [] });
        return;
      }
      const found = result.spec;
      const category = found.category ?? draft.category;
      setDraft((current) => ({
        ...current,
        brand: found.brand ?? "",
        model: found.model ?? "",
        version: found.version ?? "",
        category,
        terrain: found.terrain ?? defaultTerrain[category],
        foam: found.foam ?? "",
        stackHeelMm: numberText(found.stackHeelMm),
        stackForefootMm: numberText(found.stackForefootMm),
        dropMm: numberText(found.dropMm),
        weightG: numberText(found.weightG),
        plate: found.plate ?? null,
        lugDepthMm: numberText(found.lugDepthMm),
        lifespanKm: lifespanTouched
          ? current.lifespanKm
          : String(defaultLifespanKm[category]),
      }));
      if (category === "trail") setGarminDefault("trail_running");
      const fields = specSourceFields.filter((key) => found[key] !== undefined);
      setPage({ url: result.url, fields, edited: [] });
      setErrors([]);
      setLinkStatus(
        `Page lue · ${fields.length} champ${fields.length > 1 ? "s" : ""} trouvé${fields.length > 1 ? "s" : ""} sur ${specSourceFields.length} · relis avant de valider`,
      );
    });
  };

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
    const fromPage = page
      ? page.fields.filter((key) => !page.edited.includes(key))
      : [];
    startTransition(async () => {
      const response =
        mode === "create"
          ? await createShoe({
              spec: result.spec,
              currentKm: km ?? 0,
              firstUseDate,
              garminDefault,
              sources:
                page && fromPage.length
                  ? { url: page.url, fields: fromPage }
                  : null,
            })
          : await updateShoe({ id, spec: result.spec });
      if (response.status === "saved" && response.id)
        router.push(`/gear/${response.id}`);
      else setMessage(gearErrorMessage(response));
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {withLink && mode === "create" && (
        <form
          onSubmit={read}
          className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5 sm:p-6"
        >
          <label htmlFor="shoe-url" className="text-sm font-semibold">
            Lien de la page produit
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="shoe-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://www.marque.fr/modele"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="min-w-0 flex-[1_1_280px]"
            />
            <Button
              type="submit"
              variant="outline"
              size="md"
              disabled={reading || url.trim().length < 8}
            >
              {reading ? "Lecture…" : page ? "Relire la page" : "Lire la page"}
            </Button>
          </div>
          {linkStatus && (
            <p
              role="status"
              className="flex items-center gap-2 text-meta text-muted"
            >
              {page && page.fields.length > 0 && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-success"
                />
              )}
              {linkStatus}
            </p>
          )}
          {!page && (
            <p className="text-xs text-muted-foreground">
              Stride lit la page et remplit la fiche. Un champ absent de la page
              reste vide : rien n’est inventé.
            </p>
          )}
        </form>
      )}

      {showForm && (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <section className="flex flex-col gap-4.5 rounded-panel border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-lead font-semibold">La paire</h2>
              {page && (
                <span className="text-xs text-muted-foreground">
                  un champ absent de la page reste vide : Stride n’invente rien
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.4fr_0.6fr]">
              <TextField
                id="shoe-brand"
                label="Marque"
                value={draft.brand}
                marker={marker("brand")}
                invalid={invalid("brand")}
                placeholder="HOKA"
                onChange={(value) => set("brand", value)}
              />
              <TextField
                id="shoe-model"
                label="Modèle"
                value={draft.model}
                marker={marker("model")}
                invalid={invalid("model")}
                placeholder="Speedgoat"
                onChange={(value) => set("model", value)}
              />
              <TextField
                id="shoe-version"
                label="Version"
                value={draft.version}
                marker={marker("version")}
                placeholder="7"
                onChange={(value) => set("version", value)}
              />
            </div>
            <Chips
              legend="Catégorie"
              options={shoeCategories}
              value={draft.category}
              labels={categoryLabels}
              marker={marker("category")}
              onChange={chooseCategory}
            />
            <Chips
              legend="Terrain"
              options={shoeTerrains}
              value={draft.terrain}
              labels={terrainLabels}
              marker={marker("terrain")}
              onChange={(value) => set("terrain", value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={invalid("lifespanKm") || undefined}>
                <FieldLabel
                  htmlFor="shoe-lifespan"
                  className="flex w-full items-center"
                >
                  Durée de vie
                  <SourceTag
                    marker={
                      lifespanTouched ? (page ? "manual" : null) : "stride"
                    }
                  />
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
                      setDraft((current) => ({
                        ...current,
                        lifespanKm: event.target.value,
                      }));
                      setErrors((current) =>
                        current.filter((error) => error !== "lifespanKm"),
                      );
                    }}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    km
                  </span>
                </div>
                <FieldDescription>
                  Garmin te prévient à ce total.
                </FieldDescription>
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
                marker={marker("foam")}
                onChange={(value) => set("foam", value)}
              />
              <TextField
                id="shoe-heel"
                label="Hauteur au talon"
                value={draft.stackHeelMm}
                marker={marker("stackHeelMm")}
                inputMode="decimal"
                suffix="mm"
                invalid={invalid("stackHeelMm")}
                onChange={(value) => set("stackHeelMm", value)}
              />
              <TextField
                id="shoe-forefoot"
                label="Hauteur à l’avant-pied"
                value={draft.stackForefootMm}
                marker={marker("stackForefootMm")}
                inputMode="decimal"
                suffix="mm"
                invalid={invalid("stackForefootMm")}
                onChange={(value) => set("stackForefootMm", value)}
              />
              <TextField
                id="shoe-drop"
                label="Drop"
                value={draft.dropMm}
                marker={marker("dropMm")}
                inputMode="decimal"
                suffix="mm"
                invalid={invalid("dropMm")}
                onChange={(value) => set("dropMm", value)}
              />
              <TextField
                id="shoe-weight"
                label="Poids"
                value={draft.weightG}
                marker={marker("weightG")}
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
                marker={marker("lugDepthMm")}
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
              marker={marker("plate")}
              onChange={(value) => set("plate", value)}
            />
            {page && (
              <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <SourceMark source="provider" />
                  lu sur la page produit
                </span>
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <SourceMark source="estimate" />
                  absent de la page, à compléter ou laisser vide
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <SourceMark source="manual" />
                  modifié par toi
                </span>
              </div>
            )}
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
                Déjà portée : saisis son total actuel, par exemple celui de
                Strava. Stride le garde comme km de départ, puis Garmin compte
                la suite.
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
                Stride crée la paire dans Garmin Connect. Garmin comptera
                ensuite chaque sortie et te préviendra quand elle atteindra sa
                durée de vie.
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
                  : page
                    ? "Valider la fiche et créer dans Garmin"
                    : "Enregistrer et créer dans Garmin"
                : pending
                  ? "Enregistrement…"
                  : "Enregistrer"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
