"use client";
import { useState } from "react";
import { CheckIcon, CloudOffIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StrideMark } from "@/components/stride/stride-mark";
import type { SaveStatus } from "@/features/onboarding/autosave";
import {
  formatFrenchDate,
  formatLongFrenchDate,
  maskFrenchDate,
  parseFrenchDate,
} from "@/features/onboarding/dates";
import type { KnownValue } from "@/features/onboarding/known-values";
import { cn } from "@/lib/utils";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="hidden font-mono text-label text-muted-foreground uppercase lg:block">
      {children}
    </h2>
  );
}

export function StrideNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <StrideMark className="mt-0.5 size-3" />
      <span>{children}</span>
    </p>
  );
}

export function NumberField({
  id,
  label,
  unit,
  value,
  min,
  max,
  onCommit,
  description,
  integer = false,
  error,
}: {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  min: number;
  max: number;
  onCommit: (value: number | null) => void;
  description?: React.ReactNode;
  integer?: boolean;
  error?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [invalid, setInvalid] = useState(false);
  const parse = (raw: string) => {
    const number = Number(raw.replace(",", "."));
    return raw.trim() === ""
      ? null
      : Number.isFinite(number) && number >= min && number <= max
        ? integer
          ? Math.round(number)
          : Math.round(number * 10) / 10
        : undefined;
  };
  return (
    <Field data-invalid={invalid || Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          inputMode="decimal"
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            const parsed = parse(event.target.value);
            if (parsed !== undefined) {
              setInvalid(false);
              onCommit(parsed);
            }
          }}
          onBlur={() => setInvalid(parse(text) === undefined)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      {invalid ? (
        <FieldDescription id={`${id}-error`} className="text-warning">
          Entre une valeur entre {min} et {max} {unit}.
        </FieldDescription>
      ) : error ? (
        <FieldDescription className="text-warning">{error}</FieldDescription>
      ) : (
        description
      )}
    </Field>
  );
}

export function TextField({
  id,
  label,
  type = "text",
  value,
  onCommit,
  autoComplete,
  maxLength = 80,
  error,
}: {
  id: string;
  label: string;
  type?: "text";
  value: string | null;
  onCommit: (value: string | null) => void;
  autoComplete?: string;
  maxLength?: number;
  error?: string;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={text}
        aria-invalid={Boolean(error) || undefined}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => {
          setText(event.target.value);
          const next = event.target.value.trim();
          onCommit(next === "" ? null : next);
        }}
      />
      {error && (
        <FieldDescription className="text-warning">{error}</FieldDescription>
      )}
    </Field>
  );
}

export function DateField({
  id,
  label,
  value,
  onCommit,
  min,
  max,
  autoComplete,
  longDate = false,
  error,
}: {
  id: string;
  label: string;
  value: string | null;
  onCommit: (value: string | null) => void;
  min?: string;
  max?: string;
  autoComplete?: string;
  longDate?: boolean;
  error?: string;
}) {
  const [text, setText] = useState(formatFrenchDate(value));
  const [invalid, setInvalid] = useState<string | null>(null);
  const check = (raw: string) => {
    const iso = parseFrenchDate(raw);
    if (iso === undefined) return "Date attendue au format JJ/MM/AAAA.";
    if (iso && min && iso < min)
      return `Choisis une date à partir du ${formatFrenchDate(min)}.`;
    if (iso && max && iso > max)
      return `Choisis une date jusqu’au ${formatFrenchDate(max)}.`;
    return null;
  };
  const iso = parseFrenchDate(text);
  const message = invalid ?? error;
  return (
    <Field data-invalid={Boolean(message)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="JJ/MM/AAAA"
        autoComplete={autoComplete}
        value={text}
        aria-invalid={Boolean(message) || undefined}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const next = maskFrenchDate(event.target.value);
          setText(next);
          if (check(next) === null) {
            setInvalid(null);
            onCommit(parseFrenchDate(next) ?? null);
          }
        }}
        onBlur={() => setInvalid(check(text))}
      />
      <FieldDescription
        id={`${id}-hint`}
        className={message ? "text-warning" : undefined}
      >
        {message ??
          (longDate && iso ? formatLongFrenchDate(iso) : "JJ/MM/AAAA")}
      </FieldDescription>
    </Field>
  );
}

export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  description,
  className,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-2.5", className)}
    >
      <span className="text-sm font-medium">{label}</span>
      <ToggleGroup
        type="single"
        value={value ?? ""}
        onValueChange={(next) => onChange((next || null) as T | null)}
        className="grid auto-cols-fr grid-flow-col"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="w-full"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {description}
    </div>
  );
}

const days = [
  { value: 1, short: "L", long: "Lundi" },
  { value: 2, short: "M", long: "Mardi" },
  { value: 3, short: "M", long: "Mercredi" },
  { value: 4, short: "J", long: "Jeudi" },
  { value: 5, short: "V", long: "Vendredi" },
  { value: 6, short: "S", long: "Samedi" },
  { value: 7, short: "D", long: "Dimanche" },
];

export function DaysField({
  value,
  onChange,
  description,
}: {
  value: number[] | null;
  onChange: (value: number[]) => void;
  description?: React.ReactNode;
}) {
  const selected = value ?? [];
  return (
    <div
      role="group"
      aria-label="Jours où tu peux courir"
      className="flex flex-col gap-2.5"
    >
      <span className="hidden text-sm font-medium lg:block">
        Jours où tu peux courir
      </span>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <ToggleGroup
          type="multiple"
          variant="day"
          value={selected.map(String)}
          onValueChange={(next) => onChange(next.map(Number).sort())}
          className="max-lg:flex-col max-lg:items-stretch"
        >
          {days.map((day) => (
            <ToggleGroupItem
              key={day.value}
              value={String(day.value)}
              aria-label={day.long}
              className="group/day max-lg:h-13 max-lg:w-full max-lg:justify-between max-lg:rounded-surface max-lg:px-4 max-lg:text-body max-lg:font-normal max-lg:data-[state=on]:font-semibold"
            >
              <span className="lg:hidden">{day.long}</span>
              <span className="hidden lg:inline">{day.short}</span>
              <span
                aria-hidden="true"
                className="grid size-5.5 place-items-center rounded-full border border-border-strong group-data-[state=on]/day:border-accent group-data-[state=on]/day:bg-accent lg:hidden"
              >
                <CheckIcon className="hidden size-3.5 text-accent-foreground group-data-[state=on]/day:block" />
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {selected.length > 0 && (
          <p className="hidden text-sm text-muted lg:block">
            <span className="font-metric text-metric-sm font-semibold text-foreground">
              {selected.length}
            </span>{" "}
            jour{selected.length > 1 ? "s" : ""} par semaine max
          </p>
        )}
      </div>
      {description}
    </div>
  );
}

const access = [
  { value: "hills", label: "Côtes à proximité" },
  { value: "incline_treadmill", label: "Tapis incliné" },
  { value: "gym", label: "Salle / renfo" },
  { value: "track", label: "Piste" },
];

export function AccessField({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (value: string[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Tu as accès à"
      className="flex flex-col gap-2.5"
    >
      <span className="text-sm font-medium">Tu as accès à</span>
      <ToggleGroup
        type="multiple"
        value={value ?? []}
        onValueChange={(next) => onChange([...next].sort())}
        className="max-lg:grid max-lg:grid-cols-2"
      >
        {access.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        Me permet de prévoir du travail en côte même sur les semaines plates.
      </p>
    </div>
  );
}

const statusCopy: Record<SaveStatus, string> = {
  saved: "Enregistré",
  unsaved: "Modifications en attente",
  saving: "Enregistrement…",
  error: "L’enregistrement a échoué.",
  offline: "Hors ligne — gardé sur cet appareil",
  conflict: "Modifié sur un autre appareil",
};

export function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  return (
    <p
      role="status"
      data-status={status}
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground lg:text-meta",
        (status === "error" || status === "conflict") && "text-warning",
      )}
    >
      {status === "saving" && (
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-3.5 motion-safe:animate-spin"
        />
      )}
      {status === "saved" && (
        <CheckIcon aria-hidden="true" className="size-3.5 text-success" />
      )}
      {status === "offline" && (
        <CloudOffIcon aria-hidden="true" className="size-3.5" />
      )}
      {statusCopy[status]}
      {status === "error" && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={onRetry}
        >
          Réessayer
        </Button>
      )}
    </p>
  );
}

export function KnownPanel({ known }: { known: KnownValue[] }) {
  if (known.length === 0) return null;
  return (
    <section aria-labelledby="known-title" className="flex flex-col">
      <h2
        id="known-title"
        className="border-b border-border pb-3 font-mono text-label text-muted-foreground uppercase"
      >
        Déjà connu — je ne demande pas
      </h2>
      <dl>
        {known.map((item) => (
          <div
            key={item.key}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-border py-3"
          >
            <dt className="text-sm">{item.label}</dt>
            <dd className="text-right font-metric text-metric-sm font-semibold">
              {item.value}
            </dd>
            <dd className="col-span-2 font-mono text-nano text-muted-foreground uppercase">
              {item.detail}
            </dd>
          </div>
        ))}
      </dl>
      <p className="pt-4 text-xs text-muted-foreground">
        Ces valeurs viennent de tes données Garmin. Tu pourras les corriger à la
        fin.
      </p>
    </section>
  );
}
