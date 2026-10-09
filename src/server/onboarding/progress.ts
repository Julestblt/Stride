import "server-only";
import {
  progressSchema,
  type ProgressSnapshot,
} from "@/features/onboarding/schemas";
import type { OnboardingContext } from "./context";
export async function readProgress(
  context: OnboardingContext,
): Promise<ProgressSnapshot | null> {
  const { data, error } = await context.client
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read onboarding progress");
  if (!data) return null;
  const parsed = progressSchema.parse(data);
  if (parsed.user_id !== context.userId)
    throw new Error("Invalid onboarding owner");
  return parsed;
}
export async function ensureProgress(
  context: OnboardingContext,
): Promise<ProgressSnapshot> {
  const existing = await readProgress(context);
  if (existing) return existing;
  const { error } = await context.client
    .from("onboarding_progress")
    .insert({ user_id: context.userId });
  if (error && error.code !== "23505")
    throw new Error("Unable to create onboarding progress");
  const progress = await readProgress(context);
  if (!progress) throw new Error("Unable to restore onboarding progress");
  return progress;
}
