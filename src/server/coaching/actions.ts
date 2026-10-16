"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { staffFaceChoiceSchema } from "@/features/coach/staff";
import { getOnboardingContext } from "@/server/onboarding/context";
import { managedClient } from "./managed/resources";
import {
  deleteOwnThread,
  findOwnThread,
  markThreadRead,
} from "./managed/store";
import { turnTimeoutMs } from "./managed/token";
import { saveStaffFace } from "./staff";

const inputSchema = z.strictObject({ threadId: z.uuid() });

export async function markCoachThreadRead(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false } as const;
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { ok: false } as const;
  await markThreadRead(context, parsed.data.threadId).catch(() => undefined);
  return { ok: true } as const;
}

export type DeleteThreadResult = {
  status:
    "deleted" | "turn_in_progress" | "not-found" | "session-expired" | "error";
};

async function archiveManagedSession(managedSessionId: string) {
  try {
    await managedClient().beta.sessions.archive(managedSessionId, null, {
      timeout: 5_000,
      maxRetries: 0,
    });
  } catch (error) {
    console.error("Managed Agents session was not archived", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function deleteCoachThread(
  input: unknown,
): Promise<DeleteThreadResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "not-found" };
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  try {
    const thread = await findOwnThread(context, parsed.data.threadId);
    if (!thread) return { status: "not-found" };
    if (
      thread.status === "running" &&
      thread.lastTurnAt !== null &&
      Date.now() - Date.parse(thread.lastTurnAt) < turnTimeoutMs
    )
      return { status: "turn_in_progress" };
    if (!(await deleteOwnThread(context, thread.id)))
      return { status: "not-found" };
    await archiveManagedSession(thread.managedSessionId);
  } catch {
    return { status: "error" };
  }
  revalidatePath("/coach", "layout");
  return { status: "deleted" };
}

export async function chooseStaffFace(input: unknown) {
  const parsed = staffFaceChoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false } as const;
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { ok: false } as const;
  const saved = await saveStaffFace(context, parsed.data).catch(() => false);
  if (!saved) return { ok: false } as const;
  revalidatePath("/", "layout");
  return { ok: true } as const;
}
