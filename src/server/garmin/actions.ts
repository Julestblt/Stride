"use server";

import type { SyncRequestResult } from "@/features/garmin/sync";
import { getGarminClient, getGarminRequestContext } from "./session";

const reconnectCodes = new Set(["reconnect_required", "disconnected"]);

export async function requestGarminSync(): Promise<SyncRequestResult> {
  const context = await getGarminRequestContext();
  if (!context) return { status: "session-expired" };
  const result = await getGarminClient()
    .requestSync(context)
    .catch(() => null);
  if (!result) return { status: "unavailable" };
  if (result.ok) return { status: "requested", sync: result.value };
  const { code, retryAfterSeconds } = result.failure;
  if (code === "unauthorized") return { status: "session-expired" };
  if (reconnectCodes.has(code)) return { status: "reconnect" };
  if (code === "sync_throttled")
    return {
      status: "throttled",
      availableAt: new Date(
        Date.now() + (retryAfterSeconds ?? 300) * 1000,
      ).toISOString(),
    };
  return { status: "unavailable" };
}
