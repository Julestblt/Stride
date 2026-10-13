import { z } from "zod";
import { profileValueSchemas } from "@/features/onboarding/profile";
import type {
  ProfileField,
  ProfilePatch,
  ProfileValues,
} from "@/features/onboarding/profile";

export function changedProfileSources(
  values: ProfilePatch,
  current: ProfileValues,
) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(
        ([key, value]) =>
          JSON.stringify(value) !==
          JSON.stringify(current[key as ProfileField]),
      )
      .map(([key]) => [key, { source: "athlete" as const }]),
  );
}

export const thresholdSources = [
  { value: "lab", label: "Test en labo" },
  { value: "field", label: "Test terrain 30 min" },
  { value: "known", label: "Je la connais" },
] as const;
export type ThresholdSource = (typeof thresholdSources)[number]["value"];
export const heartRateOverrideSchema = z.number().int().min(100).max(230);
export const profileDraftSchema = z
  .strictObject({
    first_name: profileValueSchemas.first_name,
    birth_date: profileValueSchemas.birth_date,
    sex: profileValueSchemas.sex,
    height_cm: profileValueSchemas.height_cm,
    weight_kg: profileValueSchemas.weight_kg,
    running_max_heart_rate_override: heartRateOverrideSchema.nullable(),
    threshold_heart_rate_override: heartRateOverrideSchema.nullable(),
    threshold_heart_rate_source: z.enum(["lab", "field", "known"]).nullable(),
  })
  .refine(
    (value) =>
      (value.threshold_heart_rate_override === null) ===
      (value.threshold_heart_rate_source === null),
  );
export type ProfileDraft = z.output<typeof profileDraftSchema>;
export type SettingsProfileSnapshot = {
  values: ProfileValues;
  revision: number | null;
  maximumOverride: number | null;
  thresholdOverride: number | null;
  thresholdSource: ThresholdSource | null;
  photoUrl: string | null;
};
export type ProfileMetric = {
  key: "maximum" | "threshold" | "resting" | "hrv" | "vo2";
  label: string;
  value: number | null;
  unit: string;
  date: string | null;
  source: "manual" | "provider" | "estimate";
  detail: string;
  providerValue?: number | null;
};
export function profileDraft(snapshot: SettingsProfileSnapshot) {
  return {
    first_name: snapshot.values.first_name ?? "",
    birth_date: snapshot.values.birth_date ?? "",
    sex: snapshot.values.sex,
    height_cm: snapshot.values.height_cm,
    weight_kg: snapshot.values.weight_kg,
    running_max_heart_rate_override: snapshot.maximumOverride,
    threshold_heart_rate_override: snapshot.thresholdOverride,
    threshold_heart_rate_source: snapshot.thresholdSource,
  };
}
export function changedDraftFields(
  draft: ReturnType<typeof profileDraft>,
  saved: ReturnType<typeof profileDraft>,
) {
  return (Object.keys(saved) as (keyof typeof saved)[]).filter(
    (key) => draft[key] !== saved[key],
  );
}
export function frenchBirthDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join(" / ")
    : value;
}
export function parseFrenchBirthDate(value: string) {
  const match = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
