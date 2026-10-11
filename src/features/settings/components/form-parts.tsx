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
}: {
  label: string;
  name: string;
  id?: string;
  value: string | number | null;
  type?: string;
  min?: string | number;
  max?: string | number;
  step?: string;
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
        defaultValue={value ?? ""}
      />
    </Field>
  );
}

export function SettingsNotice({ status }: { status?: string }) {
  if (!status) return null;
  const message =
    status === "saved"
      ? "Changes saved."
      : status === "deleted"
        ? "Race removed."
        : status === "conflict"
          ? "This information changed elsewhere. Review the latest values and try again."
          : status === "invalid"
            ? "Check the entered values and try again."
            : status === "session-expired"
              ? "Your session expired. Sign in again."
              : "Changes could not be saved. Try again.";
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
