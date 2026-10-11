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
