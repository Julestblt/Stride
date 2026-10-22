"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOnboardingContext } from "@/server/onboarding/context";

export type CheckInActionResult =
  | { status: "checked-in" | "undone" }
  | {
      status:
        | "not-due"
        | "not-found"
        | "invalid-request"
        | "session-expired"
        | "error";
    };

const inputSchema = z.strictObject({
  planId: z.uuid(),
  sessionKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
});

function failure(message: string): CheckInActionResult {
  if (message === "not_due") return { status: "not-due" };
  if (message === "not_checkable") return { status: "invalid-request" };
  if (message === "not_found") return { status: "not-found" };
  if (message === "not_authenticated") return { status: "session-expired" };
  return { status: "error" };
}

async function run(
  input: unknown,
  rpc: "check_in_session" | "clear_session_match",
  success: CheckInActionResult,
): Promise<CheckInActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid-request" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const { error } = await context.client.rpc(rpc, {
    p_plan_id: parsed.data.planId,
    p_session_key: parsed.data.sessionKey,
  });
  if (error) return failure(error.message);
  revalidatePath("/plan", "layout");
  revalidatePath("/today");
  return success;
}

export async function checkInSession(
  input: unknown,
): Promise<CheckInActionResult> {
  return run(input, "check_in_session", { status: "checked-in" });
}

export async function undoCheckIn(
  input: unknown,
): Promise<CheckInActionResult> {
  return run(input, "clear_session_match", { status: "undone" });
}
