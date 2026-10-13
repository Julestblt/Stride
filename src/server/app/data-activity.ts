import "server-only";
import { getGarminClient } from "@/server/garmin/session";
import type { GarminRequestContext } from "@/server/garmin/client";
import type { DataActivityObservation } from "@/features/data-activity/model";

export async function readDataActivity(
  context: GarminRequestContext,
): Promise<
  | { ok: true; value: DataActivityObservation }
  | { ok: false; unauthorized: boolean }
> {
  try {
    const client = getGarminClient();
    const [connection, sync] = await Promise.all([
      client.getConnection(context),
      client.getSync(context),
    ]);
    if (!connection.ok || !sync.ok)
      return {
        ok: false,
        unauthorized:
          (!connection.ok && connection.failure.code === "unauthorized") ||
          (!sync.ok && sync.failure.code === "unauthorized"),
      };
    return {
      ok: true,
      value: { connection: connection.value.status, sync: sync.value },
    };
  } catch {
    return { ok: false, unauthorized: false };
  }
}
