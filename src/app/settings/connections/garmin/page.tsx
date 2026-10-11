import Link from "next/link";
import {
  SettingsGroup,
  SettingsHeading,
  UnavailableSettingRow,
} from "@/features/settings/components/settings-shell";
import { garminSyncCategories } from "@/features/garmin/sync";
import { requireAthlete } from "@/server/app/session";
import { readSettingsConnection } from "@/server/settings/data";

const labels = {
  activities: "Activities",
  recovery: "Recovery observations",
  fitness: "Fitness observations",
  patterns: "Training patterns",
};

export default async function GarminSettingsPage() {
  const context = await requireAthlete();
  const { connection, sync } = await readSettingsConnection(context);
  return (
    <>
      <p className="mb-3 text-xs text-muted">
        <Link href="/settings/connections" className="hover:text-foreground">
          Connections
        </Link>{" "}
        / Garmin
      </p>
      <SettingsHeading
        title="Garmin"
        description="Status and coverage from the connected Garmin integration."
      />
      <div className="mb-9 rounded-surface border border-border bg-surface p-5">
        <strong className="block text-lg">
          {connection?.status === "connected"
            ? "Connected"
            : connection
              ? connection.status.replaceAll("_", " ")
              : "Status unavailable"}
        </strong>
        <p className="mt-1 text-sm text-muted">
          {connection?.connectedAt
            ? `Connected ${new Date(connection.connectedAt).toLocaleDateString("en-GB")}`
            : "Connection date unavailable"}
          {connection?.lastSyncAt
            ? ` · Last sync ${new Date(connection.lastSyncAt).toLocaleString("en-GB", { timeZone: "Europe/Paris" })}`
            : ""}
        </p>
      </div>
      <SettingsGroup title="Garmin data">
        {sync ? (
          garminSyncCategories.map((category) => {
            const item = sync.categories[category];
            return (
              <div
                key={category}
                className="flex flex-wrap items-center gap-3 border-b border-border p-4 text-sm last:border-b-0 md:px-0"
              >
                <strong className="min-w-44 flex-1">{labels[category]}</strong>
                <span className="text-muted">
                  {item.oldestSynchronizedDate
                    ? `Since ${item.oldestSynchronizedDate}`
                    : "Coverage unavailable"}
                </span>
                <span
                  className={
                    item.state === "complete" ? "text-success" : "text-warning"
                  }
                >
                  {item.state}
                  {item.activityCount !== null
                    ? ` · ${item.activityCount}`
                    : ""}
                </span>
              </div>
            );
          })
        ) : (
          <p className="p-4 text-sm text-muted md:px-0">
            Sync status is unavailable right now.
          </p>
        )}
      </SettingsGroup>
      <SettingsGroup title="Data use">
        <div className="border-b border-border p-4 md:px-0">
          <strong className="text-sm">
            Read imported activities and observations
          </strong>
          <p className="mt-1 text-sm text-muted">
            Stride uses the normalized data already stored for your account.
          </p>
        </div>
        <UnavailableSettingRow
          title="Send workouts to Garmin"
          detail="Workout publishing is not supported by the current integration."
        />
      </SettingsGroup>
      <p className="rounded-surface border border-border p-4 text-sm text-muted">
        Manual sync, reconnect and disconnect are unavailable until the Garmin
        integration exposes those operations. Your stored data remains visible
        in Stride.
      </p>
    </>
  );
}
