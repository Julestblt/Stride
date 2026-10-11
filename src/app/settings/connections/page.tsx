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

export default async function ConnexionsSettingsPage() {
  const context = await requireAthlete();
  const [state, counts] = await Promise.all([
    readSettingsConnection(context),
    readStoredCounts(context),
  ]);
  const connected = state.connection?.status === "connected";
  const status = connected
    ? "Connecté"
    : state.connection
      ? "À vérifier"
      : "Indisponible";
  return (
    <>
      <SettingsHeading
        title="Connexions"
        description="Garmin fournit les activités et les données de santé de ton historique."
      />
      <div className="mb-9 overflow-hidden rounded-surface border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-control border border-border-strong font-semibold">
            G
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Garmin</h2>
            <p className="text-sm text-muted">
              État de la connexion :{" "}
              <span className={connected ? "text-success" : "text-warning"}>
                {status}
              </span>
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/settings/connections/garmin">Gérer</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 border-t border-border md:grid-cols-3">
          <div className="p-5">
            <strong className="block font-metric text-2xl">
              {counts.activities ?? "—"}
            </strong>
            <span className="font-mono text-label text-muted uppercase">
              Activités enregistrées
            </span>
          </div>
          <div className="border-l border-border p-5">
            <strong className="block font-metric text-2xl">
              {counts.observations ?? "—"}
            </strong>
            <span className="font-mono text-label text-muted uppercase">
              Mesures de santé
            </span>
          </div>
          <div className="col-span-2 border-t border-border p-5 md:col-span-1 md:border-t-0 md:border-l">
            <strong className="block text-sm">
              {state.connection?.lastSyncAt
                ? new Date(state.connection.lastSyncAt).toLocaleString(
                    "fr-FR",
                    { timeZone: "Europe/Paris" },
                  )
                : "Aucune synchro enregistrée"}
            </strong>
            <span className="font-mono text-label text-muted uppercase">
              Dernière synchro
            </span>
          </div>
        </div>
      </div>
      <SettingsGroup title="Autres sources">
        <div className="border-b border-border p-4 md:px-0">
          <strong className="text-sm">Autres montres et applications</strong>
          <p className="mt-1 text-sm text-muted">
            Les autres fournisseurs ne sont pas encore pris en charge.
          </p>
        </div>
        <div className="p-4 md:px-0">
          <strong className="text-sm">Saisie manuelle</strong>
          <p className="mt-1 text-sm text-muted">
            L’ajout de séances sans montre n’est pas encore disponible.
          </p>
        </div>
      </SettingsGroup>
    </>
  );
}
