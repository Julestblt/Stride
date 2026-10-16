"use server";

import { z } from "zod";
import { getOnboardingContext } from "@/server/onboarding/context";
import { markThreadRead } from "./managed/store";

const inputSchema = z.strictObject({ threadId: z.uuid() });

export async function markCoachThreadRead(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false } as const;
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { ok: false } as const;
  await markThreadRead(context, parsed.data.threadId).catch(() => undefined);
  return { ok: true } as const;
}
