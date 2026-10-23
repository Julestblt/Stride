"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  notificationColumns,
  notificationTarget,
  windowStart,
} from "@/features/notifications/model";
import { getOnboardingContext } from "@/server/onboarding/context";

const openSchema = z.strictObject({ id: z.uuid() });

async function findAndRead(id: string) {
  const context = await getOnboardingContext({ writable: true });
  if (!context) return null;
  const { data, error } = await context.client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", context.userId)
    .eq("id", id)
    .select(notificationColumns);
  if (error) return null;
  return data[0] ?? null;
}

export async function openNotification(input: unknown) {
  const source =
    input instanceof FormData ? { id: input.get("id") } : (input ?? {});
  const parsed = openSchema.safeParse(source);
  const row = parsed.success
    ? await findAndRead(parsed.data.id).catch(() => null)
    : null;
  revalidatePath("/notifications");
  redirect(notificationTarget(row));
}

export type MarkAllReadResult = {
  status: "saved" | "session-expired" | "error";
};

export async function markAllNotificationsRead(): Promise<MarkAllReadResult> {
  const context = await getOnboardingContext({ writable: true });
  if (!context) return { status: "session-expired" };
  const now = new Date();
  const { error } = await context.client
    .from("notifications")
    .update({ read_at: now.toISOString() })
    .eq("user_id", context.userId)
    .is("read_at", null)
    .gte("occurred_at", windowStart(now).toISOString());
  if (error) return { status: "error" };
  revalidatePath("/notifications");
  return { status: "saved" };
}
