"use client";

import type { HeartRateZones } from "@/features/onboarding/heart-rate-zones";
import Image from "next/image";
import { profileValueSchemas } from "@/features/onboarding/profile";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ProvenanceLabel } from "@/components/stride/provenance";
import { cn } from "@/lib/utils";
import {
  changedDraftFields,
  changedProfileSources,
  frenchBirthDate,
  parseFrenchBirthDate,
  profileDraft,
  profileDraftSchema,
  type SettingsProfileSnapshot,
  type ProfileMetric,
} from "../profile";
import { updateSettingsProfile } from "@/server/settings/actions";
import { HeartRateEditor } from "./heart-rate-editor";

type Draft = ReturnType<typeof profileDraft>;
const rowClass =
  "flex flex-col gap-1.5 border-b border-subtle px-4 py-3 min-[1100px]:grid min-[1100px]:grid-cols-[180px_320px_minmax(0,1fr)] min-[1100px]:items-center min-[1100px]:gap-5 min-[1100px]:border-border min-[1100px]:px-0 min-[1100px]:py-3.5";
const labels: Partial<Record<keyof Draft, string>> = {
  first_name: "Prénom",
  birth_date: "Date de naissance",
  sex: "Sexe",
  height_cm: "Taille",
  weight_kg: "Poids",
  running_max_heart_rate_override: "FC max",
  threshold_heart_rate_override: "FC au seuil",
};

export function ProfileForm({
  snapshot,
  metrics,
  observedMaximum,
  providerThreshold,
  zones,
}: {
  snapshot: SettingsProfileSnapshot;
  metrics: ProfileMetric[];
  observedMaximum: number | null;
  providerThreshold: number | null;
  zones: HeartRateZones | null;
}) {
  const [saved, setSaved] = useState(snapshot);
  const [draft, setDraft] = useState<Draft>(() => profileDraft(snapshot));
  const rawFields = (values: Draft) => ({
    birth_date: frenchBirthDate(values.birth_date),
    height_cm:
      values.height_cm === null
        ? ""
        : new Intl.NumberFormat("fr-FR").format(values.height_cm),
    weight_kg:
      values.weight_kg === null
        ? ""
        : new Intl.NumberFormat("fr-FR").format(values.weight_kg),
  });
  const [raw, setRaw] = useState(() => rawFields(profileDraft(snapshot)));
  const mobileScroll = useRef(0);
  const lastEditor = useRef<"maximum" | "threshold">("threshold");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<"maximum" | "threshold" | null>(null);
  const [mobile, setMobile] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const maximumTrigger = useRef<HTMLButtonElement>(null);
  const thresholdTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1099px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const changes = changedDraftFields(draft, profileDraft(saved)).filter(
    (key) => key !== "threshold_heart_rate_source",
  );
  if (
    draft.threshold_heart_rate_source !== saved.thresholdSource &&
    !changes.includes("threshold_heart_rate_override")
  )
    changes.push("threshold_heart_rate_override");
  const count = changes.length + (photo ? 1 : 0);
  const sources = {
    ...saved.values.value_sources,
    ...changedProfileSources(
      {
        first_name: draft.first_name,
        birth_date: draft.birth_date,
        sex: draft.sex,
        height_cm: draft.height_cm,
        weight_kg: draft.weight_kg,
      },
      saved.values,
    ),
  };
  const valid = profileDraftSchema.safeParse(draft).success;
  const closeEditor = () => {
    const active = editor;
    if (active) lastEditor.current = active;
    setEditor(null);
    if (mobile)
      window.scrollTo({ top: mobileScroll.current, behavior: "instant" });
    requestAnimationFrame(() =>
      (active === "maximum" ? maximumTrigger : thresholdTrigger).current?.focus(
        { preventScroll: true },
      ),
    );
  };
  const editorContent = editor && (
    <HeartRateEditor
      key={editor}
      kind={editor}
      zones={zones}
      value={
        editor === "maximum"
          ? (draft.running_max_heart_rate_override ?? observedMaximum)
          : (draft.threshold_heart_rate_override ?? providerThreshold)
      }
      source={draft.threshold_heart_rate_source}
      onCancel={closeEditor}
      onApply={(value, source) => {
        setDraft((current) =>
          editor === "maximum"
            ? { ...current, running_max_heart_rate_override: value }
            : {
                ...current,
                threshold_heart_rate_override: value,
                threshold_heart_rate_source: source,
              },
        );
        closeEditor();
      }}
      onRevert={() => {
        setDraft((current) =>
          editor === "maximum"
            ? { ...current, running_max_heart_rate_override: null }
            : {
                ...current,
                threshold_heart_rate_override: null,
                threshold_heart_rate_source: null,
              },
        );
        closeEditor();
      }}
    />
  );
  const initials = (draft.first_name || "?")
    .trim()
    .slice(0, 2)
    .toLocaleUpperCase("fr-FR");
  function provenance(
    field: "first_name" | "birth_date" | "sex" | "height_cm" | "weight_kg",
  ) {
    const source = sources[field];
    return (
      <ProvenanceLabel
        source={source?.source === "garmin" ? "provider" : "manual"}
      >
        {source?.source === "garmin"
          ? `Garmin · ${new Date(`${source.observed_on}T12:00:00`).toLocaleDateString("fr-FR")}`
          : "Saisi à la main"}
        {field === "birth_date"
          ? " · sert aux estimations liées à l’âge"
          : field === "sex"
            ? " · sert aux estimations de dépense énergétique"
            : ""}
      </ProvenanceLabel>
    );
  }
  function personalRow(
    field: "first_name" | "birth_date" | "height_cm" | "weight_kg",
    label: string,
    unit?: string,
  ) {
    const numeric = field === "height_cm" || field === "weight_kg";
    const display = field === "first_name" ? draft.first_name : raw[field];
    const invalid = !profileValueSchemas[field].safeParse(draft[field]).success;
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (field !== "first_name")
        setRaw((current) => ({ ...current, [field]: value }));
      setDraft((current) => ({
        ...current,
        [field]: numeric
          ? value === ""
            ? null
            : Number(value.replace(",", "."))
          : field === "birth_date"
            ? parseFrenchBirthDate(value)
            : value,
      }));
    };
    return (
      <Field className={rowClass} key={field} data-invalid={invalid}>
        <div className="flex min-h-11 items-center justify-between gap-3 min-[1100px]:contents">
          <FieldLabel htmlFor={field} className="shrink-0 font-normal">
            {label}
          </FieldLabel>
          {unit ? (
            <InputGroup
              className={cn(
                "h-11 w-40 shrink-0 bg-surface-raised min-[1100px]:h-10! min-[1100px]:w-full min-[1100px]:bg-surface",
                sources[field]?.source === "garmin" && "border-dashed",
              )}
            >
              <InputGroupInput
                className="min-[1100px]:h-10!"
                id={field}
                name={field}
                aria-invalid={invalid}
                aria-label={`${label} (${unit})`}
                inputMode="decimal"
                value={display}
                onChange={onChange}
              />
              <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
            </InputGroup>
          ) : (
            <Input
              id={field}
              name={field}
              aria-invalid={invalid}
              value={display}
              onChange={onChange}
              className="h-11 w-40 shrink-0 bg-surface-raised min-[1100px]:h-10! min-[1100px]:w-full min-[1100px]:bg-surface"
              autoComplete={field === "first_name" ? "given-name" : "bday"}
              placeholder={
                field === "birth_date" ? "JJ / MM / AAAA" : undefined
              }
            />
          )}
        </div>
        {invalid ? (
          <span role="status" className="text-xs text-danger">
            {field === "birth_date"
              ? "Saisis une date valide : JJ / MM / AAAA."
              : numeric
                ? `${label} : ${field === "height_cm" ? "100 à 250 cm" : "25 à 250 kg"}.`
                : "Saisis un prénom de 1 à 80 caractères."}
          </span>
        ) : (
          provenance(field)
        )}
      </Field>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          setMessage(
            "Vérifie le prénom, la date de naissance, la taille (100 à 250 cm) et le poids (25 à 250 kg).",
          );
          return;
        }
        if (editor || pending) return;
        const data = new FormData();
        data.set(
          "profile",
          JSON.stringify({ draft, revision: saved.revision }),
        );
        if (photo) data.set("photo", photo);
        startTransition(async () => {
          const result = await updateSettingsProfile(data);
          setMessage(result.message ?? "L’enregistrement a échoué.");
          if (result.status === "saved") {
            setSaved(result.snapshot);
            setDraft(profileDraft(result.snapshot));
            setRaw(rawFields(profileDraft(result.snapshot)));
            setPhoto(null);
            setPreview(null);
          }
        });
      }}
      className="flex flex-col gap-5.5 min-[1100px]:gap-9"
    >
      <section className="flex flex-col gap-2 px-1 min-[1100px]:px-0">
        <h1 className="text-2xl font-semibold tracking-tight min-[1100px]:text-[32px]">
          Profil
        </h1>
        <p className="text-sm leading-relaxed text-muted min-[1100px]:text-body">
          Corrige ce que Garmin a mal relevé. Une valeur modifiée devient la
          tienne et n’est plus écrasée.
        </p>
        <div className="flex gap-3 pt-1 min-[1100px]:hidden">
          <ProvenanceLabel source="provider">Garmin</ProvenanceLabel>
          <ProvenanceLabel source="manual">Toi</ProvenanceLabel>
          <ProvenanceLabel source="estimate">Estimation Stride</ProvenanceLabel>
        </div>
      </section>
      <fieldset disabled={pending} className="min-w-0">
        <legend className="mb-2 w-full px-1.5 font-mono text-micro font-normal tracking-wider text-muted-foreground uppercase min-[1100px]:mb-0 min-[1100px]:border-b min-[1100px]:border-border-strong min-[1100px]:px-0 min-[1100px]:pb-2.5 min-[1100px]:text-label">
          Toi
        </legend>
        <FieldGroup className="gap-0 overflow-hidden rounded-panel border border-border bg-surface min-[1100px]:rounded-none min-[1100px]:border-0 min-[1100px]:bg-transparent max-[1100px]:[&>:last-child]:border-b-0">
          <Field className={rowClass}>
            <div className="flex min-h-11 items-center justify-between gap-3 min-[1100px]:contents">
              <FieldLabel className="font-normal">Photo</FieldLabel>
              <div className="flex items-center gap-2.5 min-[1100px]:gap-3">
                <span className="text-xs text-muted-foreground min-[1100px]:hidden">
                  Facultatif
                </span>
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-card bg-border font-semibold">
                  {(preview || saved.photoUrl) &&
                  (preview ?? saved.photoUrl) !== failedPhoto ? (
                    <Image
                      unoptimized
                      width={44}
                      height={44}
                      src={preview ?? saved.photoUrl ?? ""}
                      onError={() => setFailedPhoto(preview ?? saved.photoUrl)}
                      alt="Ta photo de profil"
                      className="size-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => upload.current?.click()}
                >
                  Importer
                </Button>
                <input
                  ref={upload}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Importer une photo de profil"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (
                      file.size > 2 * 1024 * 1024 ||
                      file.size === 0 ||
                      !["image/jpeg", "image/png", "image/webp"].includes(
                        file.type,
                      )
                    ) {
                      setMessage(
                        "Choisis une image JPEG, PNG ou WebP de moins de 2 Mo.",
                      );
                      return;
                    }
                    try {
                      const image = await createImageBitmap(file);
                      image.close();
                      setPhoto(file);
                      setPreview(URL.createObjectURL(file));
                      setMessage("");
                    } catch {
                      setMessage("Choisis une image valide.");
                    }
                  }}
                />
              </div>
            </div>
            <span className="hidden text-xs text-muted-foreground min-[1100px]:block">
              Facultatif · JPEG, PNG, WebP · 2 Mo max
            </span>
          </Field>
          {personalRow("first_name", "Prénom")}
          {personalRow("birth_date", "Date de naissance")}
          <Field className={rowClass}>
            <FieldLabel id="profile-sex" className="font-normal">
              Sexe
            </FieldLabel>
            <ToggleGroup
              type="single"
              aria-labelledby="profile-sex"
              value={draft.sex ?? ""}
              className="flex-nowrap gap-1.5"
              onValueChange={(sex) => {
                if (sex === "female" || sex === "male" || sex === "unspecified")
                  setDraft((current) => ({ ...current, sex }));
              }}
            >
              {[
                { value: "female", label: "Femme" },
                { value: "male", label: "Homme" },
                { value: "unspecified", label: "Non précisé" },
              ].map((item) => (
                <ToggleGroupItem
                  className="min-w-0 flex-1 px-2 text-sm"
                  value={item.value}
                  key={item.value}
                >
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {provenance("sex")}
          </Field>
          {personalRow("height_cm", "Taille", "cm")}
          {personalRow("weight_kg", "Poids", "kg")}
        </FieldGroup>
      </fieldset>
      <section>
        <div className="mb-2 flex flex-col gap-1 px-1.5 min-[1100px]:mb-0 min-[1100px]:flex-row min-[1100px]:items-baseline min-[1100px]:justify-between min-[1100px]:border-b min-[1100px]:border-border-strong min-[1100px]:px-0 min-[1100px]:pb-2.5">
          <h2 className="font-mono text-micro font-normal tracking-wider text-muted-foreground uppercase min-[1100px]:text-label">
            Issu de ton entraînement
          </h2>
          <p className="text-xs text-muted-foreground">
            Lu dans tes données · modifie seulement si tu sais mieux
          </p>
        </div>
        <div className="overflow-hidden rounded-panel border border-border bg-surface min-[1100px]:rounded-none min-[1100px]:border-0 min-[1100px]:bg-transparent max-[1100px]:[&>:last-child>div]:border-b-0">
          {metrics.map((metric) => {
            const value =
              metric.key === "maximum"
                ? (draft.running_max_heart_rate_override ?? observedMaximum)
                : metric.key === "threshold"
                  ? (draft.threshold_heart_rate_override ?? providerThreshold)
                  : metric.value;
            const manual =
              metric.key === "maximum"
                ? draft.running_max_heart_rate_override !== null
                : metric.key === "threshold" &&
                  draft.threshold_heart_rate_override !== null;
            const editable =
              metric.key === "maximum" || metric.key === "threshold";
            return (
              <div key={metric.key}>
                {editor === metric.key && !mobile ? (
                  <div className="border-b border-border py-4">
                    {editorContent}
                  </div>
                ) : (
                  <div className={rowClass}>
                    <div className="flex justify-between gap-3 min-[1100px]:contents">
                      <span className="text-body min-[1100px]:text-sm">
                        {metric.label}
                      </span>
                      <span className="font-metric text-title font-semibold">
                        {value === null
                          ? "—"
                          : new Intl.NumberFormat("fr-FR", {
                              maximumFractionDigits: 1,
                            }).format(value)}
                        {value === null ? "" : ` ${metric.unit}`}
                      </span>
                    </div>
                    <div className="flex min-h-7 items-center justify-between gap-2">
                      <ProvenanceLabel
                        source={
                          manual
                            ? "manual"
                            : metric.key === "maximum"
                              ? "estimate"
                              : "provider"
                        }
                      >
                        {value === null
                          ? "Donnée indisponible"
                          : manual
                            ? "Ta valeur"
                            : metric.key === "maximum"
                              ? "Observée en course · 365 derniers jours"
                              : metric.key === "threshold"
                                ? "Garmin"
                                : metric.detail}
                        {value !== null && !manual && metric.date
                          ? ` · ${new Date(metric.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                          : ""}
                      </ProvenanceLabel>
                      {editable && (
                        <Button
                          ref={
                            metric.key === "maximum"
                              ? maximumTrigger
                              : thresholdTrigger
                          }
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Modifier ${metric.label}`}
                          disabled={pending}
                          onClick={() => {
                            if (mobile) {
                              mobileScroll.current = window.scrollY;
                              window.scrollTo({ top: 0, behavior: "instant" });
                            }
                            setEditor(metric.key as "maximum" | "threshold");
                          }}
                        >
                          Modifier
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {message && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {message}
        </p>
      )}
      {count > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-card border border-border-strong bg-surface-raised p-3 min-[1100px]:bottom-4 min-[1100px]:w-fit min-[1100px]:gap-3 min-[1100px]:px-4.5">
          <span className="flex-1 text-sm">
            {count}{" "}
            {count === 1
              ? "modification non enregistrée"
              : "modifications non enregistrées"}{" "}
            ·{" "}
            {[
              ...changes.map((key) => labels[key]),
              ...(photo ? ["Photo"] : []),
            ].join(", ")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={pending}
            onClick={() => {
              setDraft(profileDraft(saved));
              setRaw(rawFields(profileDraft(saved)));
              setPhoto(null);
              setPreview(null);
              setMessage("");
              closeEditor();
            }}
          >
            Annuler
          </Button>
          <Button type="submit" size="md" disabled={pending || !!editor}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      )}
      <Sheet
        open={mobile && editor !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[95svh] gap-4 overflow-y-auto rounded-t-[18px] border-border-strong bg-surface-raised px-5 pt-2 pb-7.5"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (lastEditor.current === "maximum"
              ? maximumTrigger
              : thresholdTrigger
            ).current?.focus({ preventScroll: true });
          }}
        >
          <span className="mx-auto h-1 w-10 rounded-mark bg-border-strong" />
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-xl">
              {editor === "maximum" ? "FC max" : "FC au seuil"}
            </SheetTitle>
            <ProvenanceLabel source="manual">Ta valeur</ProvenanceLabel>
          </div>
          <SheetDescription className="sr-only">
            Appliquer modifie le brouillon. Enregistre ensuite ton profil.
          </SheetDescription>
          {editorContent}
        </SheetContent>
      </Sheet>
    </form>
  );
}
