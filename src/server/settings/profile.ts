import "server-only";
import { z } from "zod";
import {
  changedProfileSources,
  profileDraftSchema,
  type SettingsProfileSnapshot,
} from "@/features/settings/profile";
import { profileRowSchema, profileValues } from "@/features/onboarding/profile";
import {
  athleteProfileColumns,
  readProfile,
} from "@/server/onboarding/profile";
import type { OnboardingContext } from "@/server/onboarding/context";
import { profilePhotoUrl, uploadProfilePhoto } from "./photo";

const capabilitiesSchema = z.object({
  running_max_heart_rate_override: z.number().nullable().optional(),
  threshold_heart_rate_override: z.number().nullable().optional(),
  threshold_heart_rate_source: z
    .enum(["lab", "field", "known"])
    .nullable()
    .optional(),
  profile_photo_path: z.string().nullable().optional(),
});
export async function readSettingsProfile(
  context: OnboardingContext,
): Promise<SettingsProfileSnapshot> {
  const { data, error } = await context.client
    .from("athlete_profiles")
    .select(athleteProfileColumns)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read profile capabilities");
  const row = data ? profileRowSchema.parse(data) : null;
  if (row && row.user_id !== context.userId)
    throw new Error("Invalid profile owner");
  const extra = capabilitiesSchema.parse(data ?? {});
  return {
    values: profileValues(row),
    revision: row?.revision ?? null,
    maximumOverride: extra.running_max_heart_rate_override ?? null,
    thresholdOverride: extra.threshold_heart_rate_override ?? null,
    thresholdSource: extra.threshold_heart_rate_source ?? null,
    photoUrl: await profilePhotoUrl(context, extra.profile_photo_path ?? null),
  };
}
export async function persistSettingsProfile(
  context: OnboardingContext,
  input: unknown,
  file: File | null,
) {
  const parsed = z
    .object({
      revision: z.number().int().positive().nullable(),
      draft: profileDraftSchema,
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid" as const,
      message:
        "Vérifie tes informations et les fréquences cardiaques (100 à 230 bpm).",
    };
  const current = await readProfile(context);
  if (parsed.data.revision !== current.revision)
    return {
      status: "conflict" as const,
      message:
        "Ton profil a changé dans un autre onglet. Recharge la page avant d’enregistrer. Tes modifications sont conservées.",
    };
  const {
    running_max_heart_rate_override,
    threshold_heart_rate_override,
    threshold_heart_rate_source,
    ...values
  } = parsed.data.draft;
  const photo = file ? await uploadProfilePhoto(context, file) : null;
  if (photo && "error" in photo)
    return {
      status: "invalid" as const,
      message: photo.error ?? "L’import de la photo a échoué.",
    };
  const update = {
    ...values,
    running_max_heart_rate_override,
    threshold_heart_rate_override,
    threshold_heart_rate_source,
    value_sources: {
      ...current.values.value_sources,
      ...changedProfileSources(values, current.values),
    },
    ...(photo && "path" in photo ? { profile_photo_path: photo.path } : {}),
  };
  const response =
    current.revision === null
      ? await context.client
          .from("athlete_profiles")
          .insert({ user_id: context.userId, ...update })
          .select("revision")
          .maybeSingle()
      : await context.client
          .from("athlete_profiles")
          .update(update)
          .eq("user_id", context.userId)
          .eq("revision", current.revision)
          .select("revision")
          .maybeSingle();
  if (response.error || !response.data) {
    if (photo && "path" in photo)
      await context.client.storage.from("profile-images").remove([photo.path]);
    return {
      status:
        response.error && response.error.code !== "23505"
          ? ("error" as const)
          : ("conflict" as const),
      message:
        "L’enregistrement a échoué ou ton profil a changé. Tes modifications sont conservées.",
    };
  }
  return {
    status: "saved" as const,
    snapshot: await readSettingsProfile(context),
    message: "Profil enregistré.",
  };
}
