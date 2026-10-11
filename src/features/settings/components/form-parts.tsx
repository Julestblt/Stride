import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SettingsField({
  label,
  name,
  id = name,
  value,
  type = "text",
  min,
  max,
  step,
  list,
}: {
  label: string;
  name: string;
  id?: string;
  value: string | number | null;
  type?: string;
  min?: string | number;
  max?: string | number;
  step?: string;
  list?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        min={min}
        max={max}
        step={step}
        list={list}
        defaultValue={value ?? ""}
      />
    </Field>
  );
}

export function SettingsNotice({ status }: { status?: string }) {
  if (!status) return null;
  const message =
    status === "saved"
      ? "Modifications enregistrées."
      : status === "deleted"
        ? "Course supprimée."
        : status === "conflict"
          ? "Ces informations ont changé. Vérifie les dernières valeurs et réessaie."
          : status === "invalid"
            ? "Vérifie les valeurs saisies et réessaie."
            : status === "session-expired"
              ? "Ta session a expiré. Connecte-toi à nouveau."
              : "Impossible d’enregistrer les modifications. Réessaie.";
  return (
    <p
      role="status"
      className={
        status === "saved" || status === "deleted"
          ? "mb-6 text-sm text-success"
          : "mb-6 text-sm text-warning"
      }
    >
      {message}
    </p>
  );
}
