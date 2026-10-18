import "server-only";
import { z } from "zod";
import {
  groupLine,
  specialistAgents,
  staffFaceColumns,
  staffFacesOf,
  staffOf,
  type SpecialistAgent,
  type StaffFaceChoice,
  type StaffFaces,
} from "@/features/coach/staff";
import { monthStart, type StaffUsage } from "@/features/coach/team";
import type { OnboardingContext } from "@/server/onboarding/context";
import { displayTimeZone } from "@/features/app-shell/shell";

const staffFaceSelect =
  "coach_face, medical_face, director_face, strategist_face, nutritionist_face";

export async function readStaffFaces(
  context: OnboardingContext,
): Promise<StaffFaces> {
  const { data, error } = await context.client
    .from("athlete_profiles")
    .select(staffFaceSelect)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) return staffFacesOf(null);
  return staffFacesOf(data);
}

export async function readGroupLine(context: OnboardingContext) {
  try {
    const { data } = await context.client
      .from("athlete_profiles")
      .select(
        "coach_face, medical_face, director_face, strategist_face, nutritionist_face, first_name",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    return groupLine(
      staffOf(staffFacesOf(data)),
      data?.first_name?.trim() || null,
    );
  } catch {
    return groupLine(staffOf(staffFacesOf(null)), null);
  }
}

export async function saveStaffFace(
  context: OnboardingContext,
  choice: StaffFaceChoice,
) {
  const { data, error } = await context.client
    .from("athlete_profiles")
    .update({ [staffFaceColumns[choice.agent]]: choice.face } as Partial<
      Record<(typeof staffFaceColumns)[keyof typeof staffFaceColumns], string>
    >)
    .eq("user_id", context.userId)
    .select("user_id");
  return !error && data.length === 1;
}

const consultRowSchema = z.object({
  coach_session_id: z.string(),
  body: z.object({ agent: z.string(), thread: z.string() }).loose(),
});

export async function loadStaffUsage(
  context: OnboardingContext,
  now: Date,
): Promise<StaffUsage> {
  const since = monthStart(now, displayTimeZone).toISOString();
  const [threads, consults] = await Promise.all([
    context.client
      .from("coach_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .not("title", "is", null)
      .gte("created_at", since),
    context.client
      .from("coach_thread_items")
      .select("coach_session_id, body")
      .eq("user_id", context.userId)
      .eq("kind", "consult_request")
      .gte("created_at", since)
      .limit(1000),
  ]);
  const rows = z
    .array(consultRowSchema)
    .catch([])
    .parse(consults.data ?? []);
  const opinions = Object.fromEntries(
    specialistAgents.map((agent) => [
      agent,
      new Set(
        rows
          .filter((row) => row.body.agent === agent)
          .map((row) => `${row.coach_session_id}:${row.body.thread}`),
      ).size,
    ]),
  ) as Record<SpecialistAgent, number>;
  return {
    conversations: threads.error ? 0 : (threads.count ?? 0),
    opinions,
  };
}
