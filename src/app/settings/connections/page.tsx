import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  SettingsGroup,
  SettingsHeading,
} from "@/features/settings/components/settings-shell";
import { requireAthlete } from "@/server/app/session";
import {
  readSettingsConnection,
  readStoredCounts,
} from "@/server/settings/data";

export default async function ConnectionsSettingsPage() {
  const context = await requireAthlete();
  const [state, counts] = await Promise.all([
    readSettingsConnection(context),
    readStoredCounts(context),
  ]);
  const status = state.connection?.status ?? "Unavailable";
  return (
    <>
      <SettingsHeading
        title="Connections"
        description="Garmin provides recorded activity and health data for your training history."
      />
      <div className="mb-9 overflow-hidden rounded-surface border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-control border border-border-strong font-semibold">
            G
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Garmin</h2>
            <p className="text-sm text-muted">
              Connection status:{" "}
              <span
                className={
                  status === "connected" ? "text-success" : "text-warning"
                }
              >
                {status.replaceAll("_", " ")}
              </span>
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/settings/connections/garmin">Manage</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 border-t border-border md:grid-cols-3">
          <div className="p-5">
            <strong className="block font-metric text-2xl">
              {counts.activities ?? "—"}
            </strong>
            <span className="font-mono text-label text-muted uppercase">
              Stored activities
            </span>
          </div>
          <div className="border-l border-border p-5">
            <strong className="block font-metric text-2xl">
              {counts.observations ?? "—"}
            </strong>
            <span className="font-mono text-label text-muted uppercase">
              Health observations
            </span>
          </div>
          <div className="col-span-2 border-t border-border p-5 md:col-span-1 md:border-t-0 md:border-l">
            <strong className="block text-sm">
              {state.connection?.lastSyncAt
                ? new Date(state.connection.lastSyncAt).toLocaleString(
                    "en-GB",
                    { timeZone: "Europe/Paris" },
                  )
                : "No sync recorded"}
            </strong>
            <span className="font-mono text-label text-muted uppercase">
              Last sync
            </span>
          </div>
        </div>
      </div>
      <SettingsGroup title="Other sources">
        <div className="border-b border-border p-4 md:px-0">
          <strong className="text-sm">Other watches and apps</strong>
          <p className="mt-1 text-sm text-muted">
            Additional providers are not supported yet.
          </p>
        </div>
        <div className="p-4 md:px-0">
          <strong className="text-sm">Manual entries</strong>
          <p className="mt-1 text-sm text-muted">
            Adding sessions without a watch is not available yet.
          </p>
        </div>
      </SettingsGroup>
    </>
  );
}
