"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SourceMark } from "@/components/stride/marks";
import { StrideMark } from "@/components/stride/stride-mark";
import {
  formatFrenchDate,
  maskFrenchDate,
  parseFrenchDate,
} from "@/features/onboarding/dates";
import { cn } from "@/lib/utils";
import {
  createShoe,
  suggestShoe,
  updateShoe,
  type SuggestionOutcome,
} from "@/server/gear/actions";
import {
  gearErrorMessage,
  invalidFieldsMessage,
  parseKm,
  parseOptionalNumber,
  parseShoeSize,
} from "../form";
import {
  categoryLabels,
  defaultGarminActivity,
  defaultLifespanKm,
  garminDefaultLabels,
  garminDefaults,
  shoeCategories,
  shoeTerrains,
  suggestedFields,
  terrainLabels,
  type GarminDefault,
  type ShoeCategory,
  type ShoeSpec,
  type ShoeTerrain,
  type SuggestedField,
} from "../model";

type Draft = {
  brand: string;
  model: string;
  version: string;
  category: ShoeCategory | null;
  terrain: ShoeTerrain | null;
  description: string;
  sizeEu: string;
  lifespanKm: string;
};

function draftOf(spec: ShoeSpec | null): Draft {
  return {
    brand: spec?.brand ?? "",
    model: spec?.model ?? "",
    version: spec?.version ?? "",
    category: spec?.category ?? null,
    terrain: spec?.terrain ?? null,
    description: spec?.description ?? "",
    sizeEu:
      spec?.sizeEu === null || spec?.sizeEu === undefined
        ? ""
        : new Intl.NumberFormat("fr-FR").format(spec.sizeEu),
    lifespanKm: spec ? String(spec.lifespanKm) : "",
  };
}

const suggestionMessages: Record<
  Exclude<SuggestionOutcome["status"], "suggested">,
  string
> = {
  unknown:
    "Stride ne reconnaît pas ce modèle. Choisis le type et le terrain toi-même.",
  unavailable: "La suggestion n’a pas abouti. Réessaie ou remplis la fiche.",
  invalid: "Écris la marque et le modèle, par exemple « HOKA Speedgoat 7 ».",
  "session-expired": "Ta session a expiré. Reconnecte-toi puis réessaie.",
};

function SourceTag({ source }: { source: "stride" | "life" | null }) {
  if (!source) return null;
  return (
    <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-nano text-muted-foreground uppercase">
      <SourceMark source="estimate" />
      {source === "stride" ? "Suggestion Stride" : "Réglage Stride"}
    </span>
  );
}

function Chips<T extends string>({
  legend,
  options,
  value,
  labels,
  suggested = false,
  invalid = false,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  value: T | null;
  labels: Record<T, string>;
  suggested?: boolean;
  invalid?: boolean;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-invalid={invalid || undefined}
    >
      <legend
        className={cn(
          "flex w-full items-center pb-2 text-meta text-muted",
          invalid && "text-danger",
        )}
      >
        {legend}
        <SourceTag source={suggested ? "stride" : null} />
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
  onChange,
  placeholder,
  inputMode,
  suffix,
  hint,
  tag = null,
}: {
  id: string;
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  suffix?: string;
  hint?: string;
  tag?: "stride" | "life" | null;
}) {
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id} className="flex w-full items-center">
        {label}
        <SourceTag source={tag} />
      </FieldLabel>
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
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

function splitName(name: string) {
  const words = name.trim().split(/\s+/);
  const last = words.at(-1) ?? "";
  const version = words.length > 2 && /^v?\d{1,2}$/i.test(last) ? last : "";
  const rest = version ? words.slice(0, -1) : words;
  return {
    brand: rest[0] ?? "",
    model: rest.slice(1).join(" "),
    version,
  };
}

export function ShoeForm({
  mode,
  id,
  spec = null,
  suggested: initialSuggested = [],
  today,
}: {
  mode: "create" | "edit";
  id?: string;
  spec?: ShoeSpec | null;
  suggested?: SuggestedField[];
  today: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(spec));
  const [suggested, setSuggested] =
    useState<SuggestedField[]>(initialSuggested);
  const [lifespanTouched, setLifespanTouched] = useState(mode === "edit");
  const [name, setName] = useState("");
  const [suggesting, startSuggesting] = useTransition();
  const [suggestion, setSuggestion] = useState("");
  const [worn, setWorn] = useState(false);
  const [currentKm, setCurrentKm] = useState("");
  const [firstUse, setFirstUse] = useState(formatFrenchDate(today));
  const [garminDefault, setGarminDefault] = useState<GarminDefault>("none");
  const [garminTouched, setGarminTouched] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const lifespanFor = (
    category: ShoeCategory | null,
    terrain: ShoeTerrain | null,
  ) =>
    category && terrain ? String(defaultLifespanKm(category, terrain)) : "";
  const clearError = (key: string) =>
    setErrors((current) => current.filter((error) => error !== key));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (!lifespanTouched && (key === "category" || key === "terrain"))
        next.lifespanKm = lifespanFor(next.category, next.terrain);
      return next;
    });
    if (key === "terrain" && mode === "create" && !garminTouched && value)
      setGarminDefault(defaultGarminActivity(value as ShoeTerrain));
    clearError(key);
    if (key === "category" || key === "terrain" || key === "description")
      setSuggested((current) => current.filter((field) => field !== key));
  };

  const complete = () => {
    setSuggestion("");
    const parts = splitName(name);
    setDraft((current) => ({
      ...current,
      brand: current.brand || parts.brand,
      model: current.model || parts.model,
      version: current.version || parts.version,
    }));
    startSuggesting(async () => {
      const result = await suggestShoe({ name });
      if (
        result.status === "unavailable" ||
        result.status === "session-expired"
      ) {
        toast.error(suggestionMessages[result.status]);
        return;
      }
      if (result.status !== "suggested") {
        setSuggestion(suggestionMessages[result.status]);
        return;
      }
      const found = result.suggestion;
      const fields = suggestedFields.filter((field) => found[field] !== null);
      setDraft((current) => {
        const category = found.category ?? current.category;
        const terrain = found.terrain ?? current.terrain;
        return {
          ...current,
          brand: found.brand ?? current.brand,
          model: found.model ?? current.model,
          version: found.version ?? current.version,
          category,
          terrain,
          description: found.description ?? current.description,
          lifespanKm: lifespanTouched
            ? current.lifespanKm
            : lifespanFor(category, terrain),
        };
      });
      setSuggested(fields);
      if (found.terrain && !garminTouched)
        setGarminDefault(defaultGarminActivity(found.terrain));
      setErrors([]);
      setSuggestion(
        "Stride connaît ce modèle · vérifie le type et le terrain.",
      );
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const nextErrors: string[] = [];
    if (!draft.brand.trim()) nextErrors.push("brand");
    if (!draft.model.trim()) nextErrors.push("model");
    if (!draft.category) nextErrors.push("category");
    if (!draft.terrain) nextErrors.push("terrain");
    const lifespan = parseOptionalNumber(draft.lifespanKm, 100, 3000);
    if (lifespan === undefined || lifespan === null)
      nextErrors.push("lifespanKm");
    const sizeEu = parseShoeSize(draft.sizeEu);
    if (sizeEu === undefined) nextErrors.push("sizeEu");
    const firstUseDate = parseFrenchDate(firstUse);
    const km = worn ? parseKm(currentKm) : 0;
    if (mode === "create") {
      if (!firstUseDate || firstUseDate > today) nextErrors.push("firstUse");
      if (km === null) nextErrors.push("currentKm");
    }
    if (nextErrors.length || !draft.category || !draft.terrain) {
      setErrors(nextErrors);
      setMessage(invalidFieldsMessage(nextErrors));
      return;
    }
    const shoe: ShoeSpec = {
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      version: draft.version.trim() || null,
      category: draft.category,
      terrain: draft.terrain,
      description: draft.description.trim() || null,
      sizeEu: sizeEu ?? null,
      lifespanKm: Math.round(lifespan ?? 0),
    };
    startTransition(async () => {
      const response =
        mode === "create"
          ? await createShoe({
              spec: shoe,
              currentKm: km ?? 0,
              firstUseDate,
              garminDefault,
              suggested,
            })
          : await updateShoe({ id, spec: shoe, suggested });
      if (response.status === "saved" && response.id) {
        toast.success(
          mode === "create" ? "Paire ajoutée." : "Paire enregistrée.",
        );
        router.push(`/gear/${response.id}`);
      } else toast.error(gearErrorMessage(response));
    });
  };

  const invalid = (key: string) => errors.includes(key);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <section className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-5 sm:p-6">
        {mode === "create" && (
          <div className="flex flex-col gap-3">
            <label htmlFor="shoe-name" className="text-sm font-semibold">
              Nom de la paire
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="shoe-name"
                autoComplete="off"
                placeholder="HOKA Speedgoat 7"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (name.trim().length >= 3) complete();
                  }
                }}
                className="min-w-0 flex-[1_1_280px]"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={suggesting || name.trim().length < 3}
                onClick={complete}
              >
                <StrideMark
                  data-icon="inline-start"
                  className="size-3.5 text-accent"
                />
                {suggesting ? "Stride cherche…" : "Compléter avec Stride"}
              </Button>
            </div>
            {suggestion && (
              <p role="status" className="text-meta text-muted">
                {suggestion}
              </p>
            )}
          </div>
        )}
        <div
          className={cn(
            "grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.4fr_0.6fr]",
            mode === "create" && "border-t border-border pt-4",
          )}
        >
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
      </section>

      <section className="flex flex-col gap-4.5 rounded-panel border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lead font-semibold">La paire</h2>
        <Chips
          legend="Type"
          options={shoeCategories}
          value={draft.category}
          labels={categoryLabels}
          suggested={suggested.includes("category")}
          invalid={invalid("category")}
          onChange={(value) => set("category", value)}
        />
        <Chips
          legend="Terrain"
          options={shoeTerrains}
          value={draft.terrain}
          labels={terrainLabels}
          suggested={suggested.includes("terrain")}
          invalid={invalid("terrain")}
          onChange={(value) => set("terrain", value)}
        />
        <Field>
          <FieldLabel
            htmlFor="shoe-description"
            className="flex w-full items-center"
          >
            Description
            <SourceTag
              source={suggested.includes("description") ? "stride" : null}
            />
          </FieldLabel>
          <Textarea
            id="shoe-description"
            rows={2}
            maxLength={240}
            value={draft.description}
            placeholder="À quoi sert la paire, ce que tu ressens en la portant."
            onChange={(event) => set("description", event.target.value)}
          />
          <FieldDescription>
            Une phrase, utile au coach pour choisir la paire de chaque séance.
          </FieldDescription>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="shoe-lifespan"
            label="Durée de vie"
            value={draft.lifespanKm}
            inputMode="numeric"
            suffix="km"
            invalid={invalid("lifespanKm")}
            hint="Garmin te prévient à ce total."
            tag={!lifespanTouched && draft.lifespanKm ? "life" : null}
            onChange={(value) => {
              setLifespanTouched(true);
              setDraft((current) => ({ ...current, lifespanKm: value }));
              clearError("lifespanKm");
            }}
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
        </div>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(2,minmax(0,240px))]">
            {worn && (
              <TextField
                id="shoe-current-km"
                label="Total actuel"
                value={currentKm}
                inputMode="decimal"
                suffix="km"
                invalid={invalid("currentKm")}
                hint="par exemple celui de Strava"
                onChange={(value) => {
                  setCurrentKm(value);
                  clearError("currentKm");
                }}
              />
            )}
            <Field data-invalid={invalid("firstUse") || undefined}>
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
                  clearError("firstUse");
                }}
              />
              <FieldDescription>
                Garmin ne lie que les sorties faites à partir de cette date.
              </FieldDescription>
            </Field>
          </div>
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
            onChange={(value) => {
              setGarminTouched(true);
              setGarminDefault(value);
            }}
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
