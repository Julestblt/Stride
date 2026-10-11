import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SettingsGroup } from "@/features/settings/components/settings-shell";
import { garminSyncCategories, syncPhase } from "@/features/garmin/sync";
import type { GarminConnectionStatus } from "@/features/garmin/connection";
import { requireAthlete } from "@/server/app/session";
import {
  readGarminRecentData,
  readSettingsConnection,
  readStoredCounts,
} from "@/server/settings/data";

const categoryLabels = {
  activities: {
    title: "Activités",
    detail: "Course, trail et autres séances enregistrées",
  },
  recovery: {
    title: "Sommeil et récupération",
    detail: "Sommeil, FC au repos, VFC et stress",
  },
  fitness: {
    title: "Indicateurs de forme",
    detail: "VO₂ max et autres mesures disponibles",
  },
  patterns: {
    title: "Habitudes d’entraînement",
    detail: "Tendances de l’historique importé",
  },
};
const stateLabels = {
  pending: "En attente",
  running: "En cours",
  partial: "Partiel",
  complete: "À jour",
  failed: "À vérifier",
};
const metricLabels: Record<string, string> = {
  resting_heart_rate_bpm: "Fréquence cardiaque au repos",
  hrv_last_night_ms: "VFC de la nuit",
  vo2_max: "VO₂ max",
  sleep_duration_seconds: "Durée de sommeil",
  sleep_score: "Score de sommeil",
  stress_level: "Niveau de stress",
  body_battery: "Body Battery",
};
function metricLabel(metric: string) {
  return metricLabels[metric] ?? "Mesure de santé";
}
const connectionLabels: Record<GarminConnectionStatus, string> = {
  disconnected: "Déconnecté",
  connecting: "Connexion en cours",
  mfa_required: "Validation nécessaire",
  connected: "Connecté · synchronisation automatique",
  expired: "Connexion expirée",
  reconnect_required: "Reconnexion nécessaire",
  rate_limited: "Garmin temporairement indisponible",
  provider_unavailable: "Garmin indisponible",
  error: "Connexion à vérifier",
};
function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(date);
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="min-w-0 py-5">
      <strong className="block truncate font-metric text-xl font-semibold md:text-2xl">
        {value}
      </strong>
      <span className="block font-mono text-label text-muted uppercase">
        {label}
      </span>
      {detail && <span className="block text-xs text-muted">{detail}</span>}
    </div>
  );
}
export default async function GarminSettingsPage() {
  const context = await requireAthlete();
  const [{ connection, sync }, counts, recent] = await Promise.all([
    readSettingsConnection(context),
    readStoredCounts(context),
    readGarminRecentData(context),
  ]);
  const phase = sync ? syncPhase(sync) : null;
  const lastSync = connection?.lastSyncAt ?? sync?.lastSyncAt;
  return (
    <>
      <p className="mb-6 text-xs text-muted">
        <Link href="/settings/connections" className="hover:text-foreground">
          Connexions
        </Link>{" "}
        / Garmin
      </p>
      <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-border pb-8">
        <span className="grid size-13 place-items-center rounded-control border border-border-strong font-semibold">
          G
        </span>
        <div className="min-w-44 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">Garmin</h1>
          <p
            className={
              connection?.status === "connected"
                ? "text-sm text-success"
                : "text-sm text-warning"
            }
          >
            {connection
              ? connectionLabels[connection.status]
              : "État de la connexion indisponible"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled
            title="La synchronisation manuelle n’est pas encore proposée par Garmin"
          >
            Synchroniser maintenant
          </Button>
          <Button
            variant="outline"
            disabled
            title="La reconnexion depuis les réglages n’est pas encore disponible"
          >
            Reconnecter
          </Button>
          <Button
            variant="outline"
            disabled
            title="La déconnexion Garmin n’est pas encore proposée"
          >
            Déconnecter…
          </Button>
        </div>
      </div>
      <div className="mb-9 grid grid-cols-2 gap-x-5 border-b border-border md:grid-cols-4">
        <Metric label="Dernière synchro" value={formatDate(lastSync)} />
        <Metric
          label="Dernière donnée santé"
          value={recent.observation?.observed_on ?? "—"}
          detail={
            recent.observation
              ? metricLabel(recent.observation.metric)
              : undefined
          }
        />
        <Metric
          label="Dernière activité importée"
          value={recent.activity?.activity_name ?? "—"}
          detail={formatDate(recent.activity?.started_at)}
        />
        <Metric
          label="Activités enregistrées"
          value={counts.activities ?? "—"}
        />
      </div>
      <SettingsGroup title="Données Garmin">
        {sync ? (
          garminSyncCategories.map((category) => {
            const item = sync.categories[category];
            const label = categoryLabels[category];
            return (
              <div
                key={category}
                className="grid gap-3 border-b border-border px-4 py-4 text-sm last:border-b-0 md:grid-cols-[minmax(12rem,1.2fr)_minmax(9rem,1fr)_minmax(8rem,0.65fr)] md:items-center md:px-0"
              >
                <div>
                  <strong className="block">{label.title}</strong>
                  <span className="text-xs text-muted">{label.detail}</span>
                </div>
                <div className="text-xs text-muted">
                  <span className="block">
                    {item.oldestSynchronizedDate
                      ? `Données depuis le ${item.oldestSynchronizedDate}`
                      : "Période non disponible"}
                  </span>
                  <span className="block">
                    {item.lastSuccessAt
                      ? `Dernière réussite : ${formatDate(item.lastSuccessAt)}`
                      : "Aucune réussite enregistrée"}
                  </span>
                </div>
                <div className="md:text-right">
                  <strong
                    className={
                      item.state === "complete"
                        ? "text-success"
                        : item.state === "failed"
                          ? "text-danger"
                          : "text-warning"
                    }
                  >
                    {stateLabels[item.state]}
                  </strong>
                  {item.activityCount !== null && (
                    <span className="block text-xs text-muted">
                      {item.activityCount} activités
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="p-4 text-sm text-muted md:px-0">
            L’état de la synchronisation est momentanément indisponible.
          </p>
        )}
      </SettingsGroup>
      <div className="grid gap-9 md:grid-cols-2">
        <SettingsGroup title="Ce que Stride peut faire">
          <div className="border-b border-border p-4 text-sm md:px-0">
            <strong>Lire tes activités et données de santé</strong>
            <p className="mt-1 text-muted">
              Stride utilise les données Garmin déjà importées dans ton compte.
            </p>
          </div>
          <div className="p-4 text-sm md:px-0">
            <strong>Envoyer des séances à ta montre</strong>
            <p className="mt-1 text-muted">
              L’envoi de séances n’est pas disponible actuellement.
            </p>
          </div>
        </SettingsGroup>
        <SettingsGroup title="Dernières données importées">
          <div className="border-b border-border p-4 text-sm md:px-0">
            <strong>
              {recent.activity?.activity_name ?? "Aucune activité importée"}
            </strong>
            <p className="mt-1 text-muted">
              {recent.activity
                ? `Importée le ${formatDate(recent.activity.imported_at)}`
                : "Les activités apparaîtront ici après leur import."}
            </p>
          </div>
          <div className="p-4 text-sm md:px-0">
            <strong>
              {recent.observation
                ? metricLabel(recent.observation.metric)
                : "Aucune donnée de santé importée"}
            </strong>
            <p className="mt-1 text-muted">
              {recent.observation
                ? `Importée le ${formatDate(recent.observation.imported_at)}`
                : "Les mesures apparaîtront ici après leur import."}
            </p>
          </div>
        </SettingsGroup>
      </div>
      <p
        role="status"
        className="rounded-surface border border-border p-4 text-sm text-muted"
      >
        {phase === "complete"
          ? `Synchronisation à jour · ${formatDate(lastSync)}`
          : phase === "importing"
            ? "L’import Garmin est en cours."
            : phase === "attention"
              ? "Certaines données Garmin demandent ton attention."
              : "Aucune synchronisation Garmin terminée pour le moment."}
      </p>
      <p className="mt-3 text-xs text-muted">
        La synchronisation manuelle, la reconnexion et la déconnexion seront
        disponibles lorsque le service Garmin proposera ces opérations.
      </p>
    </>
  );
}
