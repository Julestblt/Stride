import "server-only";
import {
  profileRowSchema,
  profileSaveSchema,
  profileValues,
  type ProfileSaveResult,
  type ProfileSnapshot,
} from "@/features/onboarding/profile";
import type { OnboardingContext } from "./context";

export async function readProfile(
  context: OnboardingContext,
): Promise<ProfileSnapshot & { updatedAt: string | null }> {
  const { data, error } = await context.client
    .from("athlete_profiles")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read athlete profile");
  if (!data)
    return { values: profileValues(null), revision: null, updatedAt: null };
  const row = profileRowSchema.parse(data);
  if (row.user_id !== context.userId) throw new Error("Invalid profile owner");
  return {
    values: profileValues(row),
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

export type ProfileSaveDependencies = {
  context: () => Promise<OnboardingContext | null>;
};

export async function saveProfile(
  dependencies: ProfileSaveDependencies,
  input: unknown,
): Promise<ProfileSaveResult> {
  const parsed = profileSaveSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const context = await dependencies.context();
    if (!context) return { status: "session-expired" };
    const current = await readProfile(context);
    if (current.revision !== parsed.data.revision)
      return {
        status: "conflict",
        snapshot: { values: current.values, revision: current.revision },
      };
    const value_sources = {
      ...current.values.value_sources,
      ...parsed.data.sources,
    };
    const response =
      current.revision === null
        ? await context.client
            .from("athlete_profiles")
            .insert({
              user_id: context.userId,
              ...parsed.data.values,
              value_sources,
            })
            .select("*")
            .maybeSingle()
        : await context.client
            .from("athlete_profiles")
            .update({ ...parsed.data.values, value_sources })
            .eq("user_id", context.userId)
            .eq("revision", current.revision)
            .select("*")
            .maybeSingle();
    if (response.error) {
      if (response.error.code === "23505")
        return { status: "conflict", snapshot: await snapshot(context) };
      if (response.error.code === "23514" || response.error.code === "22P02")
        return { status: "invalid" };
      return { status: "error" };
    }
    if (!response.data)
      return { status: "conflict", snapshot: await snapshot(context) };
    const row = profileRowSchema.parse(response.data);
    return {
      status: "saved",
      snapshot: { values: profileValues(row), revision: row.revision },
    };
  } catch {
    return { status: "error" };
  }
}

async function snapshot(context: OnboardingContext): Promise<ProfileSnapshot> {
  const { values, revision } = await readProfile(context);
  return { values, revision };
}
