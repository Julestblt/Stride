import { z } from "zod";
import { onboardingSteps } from "./progress";
const timestamp = z.iso.datetime({ offset: true }).nullable();
export const progressSchema = z.object({
  user_id: z.uuid(),
  current_step: z.string(),
  revision: z.number().int().nonnegative(),
  completed_at: timestamp,
  welcome_completed_at: timestamp,
  garmin_completed_at: timestamp,
  history_completed_at: timestamp,
  about_completed_at: timestamp,
  goals_completed_at: timestamp,
  profile_completed_at: timestamp,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type ProgressSnapshot = z.output<typeof progressSchema>;
export const transitionSchema = z.strictObject({
  step: z.enum(onboardingSteps),
  revision: z.number().int().nonnegative().max(2147483647),
});
export type OnboardingActionResult =
  | { status: "success"; progress: ProgressSnapshot; href: string }
  | {
      status: "error";
      code:
        | "invalid-input"
        | "session-expired"
        | "conflict"
        | "locked"
        | "data-incomplete"
        | "reconnect"
        | "unavailable"
        | "disabled";
      message: string;
      progress?: ProgressSnapshot;
    };
