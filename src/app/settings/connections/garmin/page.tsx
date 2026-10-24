import type { Metadata } from "next";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GarminConnectionLabel } from "@/features/data-activity/components/connection-status";
import {
  SyncNowButton,
  SyncRequestMessage,
} from "@/features/data-activity/components/sync-request";
import { garminSyncCategories, syncPhase } from "@/features/garmin/sync";
import type { GarminConnectionStatus } from "@/features/garmin/connection";
import {
  clockLabel,
  dayLabel,
  recentLabel,
  relativeSince,
  sinceLabel,
  timelineCells,
  type YearCell,
} from "@/features/garmin/settings-view";
import {
  latestSentAt,
  watchRowLabel,
  watchSentLabel,
  watchUpcoming,
} from "@/features/garmin/watch";
import {
  WatchRowAction,
  WatchToggle,
} from "@/features/garmin/components/watch-settings";
import { cn } from "@/lib/utils";
import { requireAthlete } from "@/server/app/session";
import { loadWatchView } from "@/server/garmin/watch";
import { loadPlanOverview } from "@/server/plans/overview";
import {
  readGarminRecentData,
  readSettingsConnection,
  readStoredCounts,
} from "@/server/settings/data";

export const metadata: Metadata = { title: "Garmin · Réglages" };

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
const metricLabels: Record<string, string> = {
  resting_heart_rate_bpm: "FC au repos",
  hrv_last_night_ms: "VFC de la nuit",
  vo2_max: "VO₂ max",
  sleep_duration_seconds: "Durée de sommeil",
  sleep_score: "Score de sommeil",
  stress_level: "Niveau de stress",
  body_battery: "Body Battery",
};
const reconnectStatuses = new Set<GarminConnectionStatus>([
  "expired",
  "reconnect_required",
]);
const unavailableStatuses = new Set<GarminConnectionStatus>([
  "rate_limited",
  "provider_unavailable",
]);

const monoLabel =
  "font-mono text-micro tracking-wider text-muted-foreground uppercase";

function WatchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      aria-hidden="true"
      className={cn("size-6.5 fill-none", className)}
    >
      <rect
        x="6"
        y="5"
        width="10"
        height="12"
        rx="3"
        className="stroke-foreground"
        strokeWidth="1.5"
      />
      <path
        d="M8 5V2.5H14V5 M8 17V19.5H14V17"
        className="stroke-foreground"
        strokeWidth="1.5"
      />
      <path
        d="M11 8.5V11L12.5 12"
        className="stroke-accent"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Timeline({ cells, label }: { cells: YearCell[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="grid grid-cols-9 gap-0.5">
      {cells.map((cell, index) => (
        <span
          key={index}
          className={cn(
            "h-2.5 rounded-xs",
            cell === "full" && "bg-provider",
            cell === "partial" && "bg-provider/40",
            cell === "none" && "border border-dashed border-border-strong",
          )}
        />
      ))}
    </div>
  );
}

function Banner({
  tone,
  children,
  aside,
}: {
  tone: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-surface border px-3.5 py-3 text-sm",
        tone === "info" && "border-border",
        tone === "success" && "border-success/30",
        tone === "warning" && "border-warning/30",
        tone === "danger" && "border-danger-border bg-danger-surface",
      )}
    >
      {tone === "info" && (
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      )}
      {tone === "success" && (
        <CheckIcon className="size-3 shrink-0 text-success" />
      )}
      {tone === "warning" && (
        <TriangleAlertIcon className="size-3 shrink-0 text-warning" />
      )}
      {tone === "danger" && (
        <span className="size-2 shrink-0 rounded-full bg-danger" />
      )}
      <span className="min-w-0 flex-1">{children}</span>
      {aside}
    </div>
  );
}

export default async function GarminSettingsPage() {
  const context = await requireAthlete();
  const [{ connection, sync }, counts, recent, overview] = await Promise.all([
    readSettingsConnection(context),
    readStoredCounts(context),
    readGarminRecentData(context),
    loadPlanOverview(context).catch(() => null),
  ]);
  const watch = await loadWatchView(context, overview?.plan ?? null);
  const upcoming =
    watch.enabled && overview
      ? watchUpcoming({
          rows: watch.rows,
          planId: overview.plan.planId,
          sessions: overview.plan.state.sessions,
          today: overview.today,
          pendingKeys: overview.proposals.flatMap((proposal) =>
            proposal.targetKeys.map((key) => key.replace(/^session:/, "")),
          ),
        })
      : [];
  const watchFailures = upcoming.filter(
    (item) => item.state.kind === "failed",
  ).length;
  const lastWatchSend = watchSentLabel(latestSentAt(watch.rows));
  const now = new Date();
  const phase = sync ? syncPhase(sync) : null;
  const lastSync = connection?.lastSyncAt ?? sync?.lastSyncAt ?? null;
  const status = connection?.status ?? null;
  const reconnect = status !== null && reconnectStatuses.has(status);
  const unavailable = status !== null && unavailableStatuses.has(status);
  const connected = status === "connected";
  const syncedAgo = relativeSince(lastSync, now);
  const lastActivity = recentLabel(recent.activity?.started_at, now);
  const lastHealth = clockLabel(recent.observation?.imported_at);
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(now),
  );
  const oldestDates = sync
    ? garminSyncCategories.flatMap((category) => {
        const value = sync.categories[category].oldestSynchronizedDate;
        return value ? [value] : [];
      })
    : [];
  const historyOldest = oldestDates.toSorted()[0] ?? null;
  const reconnectedLabel = dayLabel(lastSync);
  const history: { key: string; when: string | null; text: string }[] = [];
  if (lastSync)
    history.push({
      key: "sync",
      when: recentLabel(lastSync, now),
      text: connected
        ? "Synchronisation automatique réussie"
        : "Dernière synchronisation",
    });
  if (recent.observation)
    history.push({
      key: "health",
      when: recentLabel(recent.observation.imported_at, now),
      text: `${metricLabels[recent.observation.metric] ?? "Mesure de santé"} importée`,
    });
  if (recent.activity)
    history.push({
      key: "activity",
      when: recentLabel(recent.activity.imported_at, now),
      text: recent.activity.activity_name ?? "Activité importée",
    });
  if (phase === "complete" && historyOldest)
    history.push({
      key: "history",
      when: recentLabel(sync?.updatedAt, now),
      text: `Import de l’historique terminé · depuis ${sinceLabel(historyOldest)}`,
    });

  const desktop = (
    <div className="flex flex-col gap-6 md:gap-10">
      <section className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="grid size-13 place-items-center rounded-surface border border-border-strong bg-surface-raised">
            <WatchIcon />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl leading-tight font-semibold tracking-tight">
              Garmin
            </h1>
            <GarminConnectionLabel
              status={status}
              connectedSuffix="synchronisation automatique"
              breathing
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SyncNowButton />
          <Button
            variant="outline"
            disabled
            title="La reconnexion depuis les réglages n’est pas encore disponible"
          >
            Reconnecter
          </Button>
          <Button
            variant="destructive"
            disabled
            title="La déconnexion Garmin n’est pas encore proposée"
          >
            Déconnecter…
          </Button>
        </div>
        <SyncRequestMessage className="basis-full text-sm md:text-right" />
      </section>

      {reconnect && (
        <Banner
          tone="danger"
          aside={
            <Button
              size="sm"
              disabled
              title="La reconnexion depuis les réglages n’est pas encore disponible"
            >
              Reconnecter Garmin
            </Button>
          }
        >
          Ta connexion Garmin a expiré. Les nouvelles sorties et nuits
          n’arrivent plus
          {reconnectedLabel ? ` depuis le ${reconnectedLabel}` : ""}.
        </Banner>
      )}

      <section className="grid grid-cols-2 border-y border-border md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]">
        {[
          {
            value: syncedAgo ?? "—",
            label: `Dernière synchro${clockLabel(lastSync) ? ` · ${clockLabel(lastSync)}` : ""}`,
          },
          {
            value: lastHealth ?? "—",
            label: "Dernière donnée santé",
          },
          {
            value: lastActivity ?? "—",
            label: "Dernière activité importée",
          },
          {
            value:
              phase === "complete"
                ? "Terminé"
                : phase === "importing"
                  ? "En cours"
                  : phase === "attention"
                    ? "À vérifier"
                    : "—",
            label: `Import de l’historique${
              phase === "complete" && sync?.updatedAt
                ? ` · ${recentLabel(sync.updatedAt, now)}`
                : ""
            }`,
            tone: phase === "complete" ? "success" : undefined,
          },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-0.75 py-4">
            <span
              className={cn(
                "truncate font-metric text-[1.75rem] leading-none font-semibold tabular-nums",
                item.tone === "success" && "text-success",
              )}
            >
              {item.value}
            </span>
            <span className={monoLabel}>{item.label}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col">
        <div className="grid items-end gap-5 border-b border-border-strong pb-2.5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
          <h2 className={monoLabel}>Données Garmin</h2>
          <div
            aria-hidden="true"
            className="hidden grid-cols-9 gap-0.5 font-mono text-nano text-muted-foreground md:grid"
          >
            {timelineCells(null, currentYear).years.map((year) => (
              <span key={year}>{String(year).slice(2)}</span>
            ))}
          </div>
          <span className={cn(monoLabel, "hidden md:block")}>Statut</span>
        </div>
        {sync ? (
          garminSyncCategories.map((category) => {
            const item = sync.categories[category];
            const label = categoryLabels[category];
            const { cells } = timelineCells(
              item.oldestSynchronizedDate,
              currentYear,
            );
            const since = sinceLabel(item.oldestSynchronizedDate);
            const value =
              item.activityCount !== null
                ? `${new Intl.NumberFormat("fr-FR").format(item.activityCount)} importées`
                : item.state === "complete" || item.state === "partial"
                  ? "Jusqu’à aujourd’hui"
                  : item.state === "failed"
                    ? "À vérifier"
                    : "En attente";
            return (
              <div
                key={category}
                className="grid items-center gap-3 border-b border-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:gap-5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-body font-semibold">{label.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {label.detail}
                  </span>
                </div>
                <Timeline
                  cells={cells}
                  label={
                    since ? `Données depuis ${since}` : "Période non disponible"
                  }
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-metric text-xl leading-tight font-semibold tabular-nums">
                    {value}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      item.state === "complete" &&
                        item.activityCount !== null &&
                        "text-success",
                      item.state === "partial" && "text-warning",
                      item.state === "failed" && "text-danger",
                      (item.state === "pending" || item.state === "running") &&
                        "text-warning",
                      item.state === "complete" &&
                        item.activityCount === null &&
                        "text-muted-foreground",
                    )}
                  >
                    {item.state === "partial" && (
                      <TriangleAlertIcon className="size-2.5" />
                    )}
                    {item.state === "complete" &&
                      (item.activityCount !== null
                        ? "À jour"
                        : since
                          ? `Depuis ${since}`
                          : "À jour")}
                    {item.state === "partial" && "Partiel"}
                    {item.state === "running" && "En cours"}
                    {item.state === "pending" && "En attente"}
                    {item.state === "failed" && "Dernière tentative échouée"}
                  </span>
                </span>
              </div>
            );
          })
        ) : (
          <p className="py-4 text-sm text-muted">
            L’état de la synchronisation est momentanément indisponible.
          </p>
        )}
        <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
          Années en pointillés : Garmin n’a aucune donnée sur la période,
          souvent parce qu’une ancienne montre ne la mesurait pas. Stride
          s’adapte aux trous, inutile de les combler.
        </p>
      </section>

      <div className="grid gap-10 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className={monoLabel}>Ce que Stride peut faire</h2>
          <div className="flex flex-col border-t border-border text-sm">
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-border py-3.25">
              <span>Lire tes activités et données de santé</span>
              <span className="font-mono text-nano tracking-wider text-success uppercase">
                Obligatoire
              </span>
              <span className="col-span-full text-xs text-muted-foreground">
                Sans ça, rien à analyser pour te coacher.
              </span>
            </div>
            <WatchToggle enabled={watch.enabled} disabled={!connected} />
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className={monoLabel}>Synchros récentes</h2>
          <div className="flex flex-col border-t border-border text-sm">
            {history.length === 0 ? (
              <p className="py-3 text-muted">
                Les synchronisations apparaîtront ici après le premier import.
              </p>
            ) : (
              history.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[5.75rem_1fr] gap-3 border-b border-border py-2.75"
                >
                  <span className="font-metric text-base font-semibold text-muted tabular-nums">
                    {item.when}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {watch.enabled && overview && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className={monoLabel}>Sur ta montre · 7 prochains jours</h2>
            {lastWatchSend && (
              <span className="ml-auto text-xs text-muted-foreground">
                Dernier envoi {lastWatchSend}
              </span>
            )}
          </div>
          <div className="flex flex-col border-t border-border">
            {upcoming.length === 0 ? (
              <p className="py-3 text-sm text-muted">
                Aucune séance prévue dans les 7 prochains jours.
              </p>
            ) : (
              upcoming.map((item) => {
                const status = watchRowLabel(item.state, {
                  pendingChange: item.pendingChange,
                });
                const action =
                  item.state.kind === "failed" ||
                  item.state.kind === "needs_confirmation"
                    ? item.copy.action
                    : null;
                return (
                  <div
                    key={item.sessionKey}
                    className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-b border-border-subtle py-3 md:grid-cols-[5.625rem_minmax(0,1fr)_auto]"
                  >
                    <span className="font-metric text-[17px] font-semibold text-muted tabular-nums">
                      {item.day}
                    </span>
                    <span className="text-sm font-semibold">{item.title}</span>
                    <span className="flex flex-wrap items-center justify-start gap-2.5 max-md:col-start-2 md:justify-end">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-[13px]",
                          status.tone === "success" && "text-success",
                          status.tone === "warning" && "text-warning",
                          status.tone === "danger" && "text-danger",
                          status.tone === "muted" && "text-muted-foreground",
                        )}
                      >
                        {status.tone === "success" && (
                          <CheckIcon aria-hidden="true" className="size-3" />
                        )}
                        {status.label}
                      </span>
                      {action && (
                        <WatchRowAction
                          sessionKey={item.sessionKey}
                          action={action.kind}
                          label={action.label}
                        />
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Les séances arrivent dans ton calendrier Garmin sous le nom « Stride
            · … » et se lancent depuis la montre comme un entraînement guidé.
            Quand ton plan change, je remplace ou retire la séance. Je ne touche
            jamais aux entraînements que tu as créés toi-même.
          </p>
        </section>
      )}

      {!reconnect && (
        <section className="flex flex-col gap-2.5">
          {watchFailures > 0 && (
            <Banner tone="warning">
              {watchFailures === 1
                ? "1 séance n’a pas pu partir vers ta montre."
                : `${watchFailures} séances n’ont pas pu partir vers ta montre.`}{" "}
              Je réessaie au prochain passage, ou tout de suite depuis la liste.
            </Banner>
          )}
          {unavailable ? (
            <Banner tone="warning">
              Garmin ne répond pas pour le moment. On réessaie régulièrement,
              tes dernières données sont en sécurité.
            </Banner>
          ) : phase === "importing" ? (
            <Banner tone="info">
              Import de ton historique en cours. Le coaching utilise déjà ce qui
              est arrivé.
            </Banner>
          ) : phase === "attention" ? (
            <Banner tone="warning">
              Certaines données Garmin demandent ton attention. Le suivi se base
              sur ce qui est déjà arrivé.
            </Banner>
          ) : phase === "complete" && syncedAgo ? (
            <Banner tone="success">
              À jour. Dernière synchro {syncedAgo}.
            </Banner>
          ) : (
            <Banner tone="warning">
              Aucune synchronisation Garmin terminée pour le moment.
            </Banner>
          )}
        </section>
      )}
    </div>
  );

  if (reconnect) {
    return (
      <>
        <div className="flex flex-col gap-4.5 md:hidden">
          <div className="flex items-center gap-3.5">
            <span className="grid size-13 place-items-center rounded-surface border border-border-strong bg-surface-raised">
              <WatchIcon />
            </span>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight">
                Garmin
              </h1>
              <GarminConnectionLabel status={status} />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-card border border-danger-border bg-danger-surface p-4">
            <p className="text-body leading-snug">
              La connexion Garmin a expiré
              {reconnectedLabel && (
                <>
                  {" "}
                  le <strong>{reconnectedLabel}</strong>
                </>
              )}
              . Rien de nouveau n’est arrivé depuis.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Ton historique est en sécurité. Je te coache avec les données
              jusque-là : le suivi de récupération est moins fiable tant que tu
              ne te reconnectes pas.
            </p>
          </div>
          <dl className="flex flex-col">
            {[
              { label: "Dernière activité reçue", value: lastActivity ?? "—" },
              {
                label: "Dernier sommeil et VFC",
                value: recentLabel(recent.observation?.imported_at, now) ?? "—",
              },
              {
                label: "Activités conservées",
                value: counts.activities ?? "—",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 border-b border-border py-3.5 first:border-t"
              >
                <dt className="text-body">{item.label}</dt>
                <dd className="font-metric text-lg font-semibold tabular-nums">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              disabled
              size="lg"
              title="La reconnexion depuis les réglages n’est pas encore disponible"
              className="h-13 w-full"
            >
              Reconnecter Garmin
            </Button>
            <p className="text-center text-xs leading-snug text-muted-foreground">
              Une seule connexion sur Garmin. Les données manquées s’importent
              automatiquement.
            </p>
          </div>
        </div>
        <div className="max-md:hidden">{desktop}</div>
      </>
    );
  }

  return desktop;
}
