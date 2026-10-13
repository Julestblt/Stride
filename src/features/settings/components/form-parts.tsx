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
