"use client";

import Link from "next/link";
import { CheckIcon, DatabaseIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PulseDot } from "@/components/stride/marks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { syncLabel } from "@/features/app-shell/shell";
import {
  garminSyncCategories,
  type GarminSyncCategory,
  type GarminSyncState,
} from "@/features/garmin/sync";
import { activityLabels } from "../model";
import { useDataActivity } from "./provider";

const categoryLabels = {
  activities: "Activités",
  recovery: "Sommeil et récupération",
  fitness: "Indicateurs de forme",
  patterns: "Habitudes d’entraînement",
};
const stateLabels = {
  pending: "en attente",
  running: "en cours…",
  partial: "import partiel",
  complete: "à jour",
  failed: "à vérifier",
};
const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

function CategoryMark({ state }: { state: GarminSyncState }) {
  if (state === "complete") {
    return (
      <CheckIcon
        aria-hidden="true"
        className="size-3.5 shrink-0 text-success"
        strokeWidth={3}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        state === "running"
          ? "bg-provider motion-safe:animate-breathe"
          : state === "pending"
            ? "border-[1.5px] border-muted-foreground"
            : "bg-warning",
      )}
    />
  );
}

export function DataActivityStatus({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const activity = useDataActivity();
  const isMobile = useIsMobile();
  if (!activity) return null;
  const { state, observation } = activity;
  const lastSync = observation?.sync.lastSyncAt;
  const synchronized = lastSync ? syncLabel(lastSync, new Date()) : null;
  const label =
    state === "complete" && synchronized
      ? `Garmin ${synchronized.toLowerCase()}`
      : state === "syncing"
        ? "Garmin · synchro…"
        : activityLabels[state];
  const completed = observation
    ? garminSyncCategories.filter(
        (key) => observation.sync.categories[key].state === "complete",
      ).length
    : 0;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className={cn(
            "flex min-h-8 min-w-0 items-center gap-2 rounded-control text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            className,
          )}
          aria-label="État des données Garmin"
          title={label}
        >
          {compact && (
            <DatabaseIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          )}
          <PulseDot
            tone={
              state === "syncing"
                ? "provider"
                : state === "complete"
                  ? "success"
                  : state === "reconnect"
                    ? "danger"
                    : "warning"
            }
            breathing={state === "syncing"}
          />
          <span
            aria-live="polite"
            aria-atomic="true"
            className={cn("truncate", compact && "sr-only")}
          >
            {label}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        className="max-h-[85svh] gap-0 border-border-strong bg-surface-raised md:max-h-none md:w-110 md:max-w-110"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong md:hidden"
        />
        <SheetHeader className="flex-row items-center justify-between gap-3 px-5 pt-5 pb-4 md:pt-12">
          <SheetTitle className="text-lead">État des données</SheetTitle>
          <SheetDescription className="shrink-0 font-mono text-nano uppercase">
            Lecture seule
          </SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 md:top-3 md:right-3"
            aria-label="Fermer"
          >
            <XIcon />
          </Button>
        </SheetClose>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pb-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-body font-semibold">
                <PulseDot tone="provider" breathing={state === "syncing"} />
                Garmin
              </span>
              {observation && (
                <span className="text-xs text-muted-foreground">
                  {completed} sur 4 à jour
                </span>
              )}
            </div>
            <div aria-hidden="true" className="h-0.5 overflow-hidden bg-border">
              <div
                className={cn(
                  "h-full bg-provider/60",
                  state === "syncing"
                    ? "motion-safe:w-[28%] motion-safe:animate-trace motion-safe:bg-linear-to-r motion-safe:from-transparent motion-safe:via-provider motion-safe:to-transparent"
                    : "w-full",
                )}
              />
            </div>
            {observation && (
              <ul className="mt-2 divide-y divide-border">
                {garminSyncCategories.map((key) => {
                  const category = observation.sync.categories[key];
                  return (
                    <li key={key} className="flex items-center gap-3 py-3.5">
                      <span className="flex w-3.5 shrink-0 justify-center">
                        <CategoryMark state={category.state} />
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        {categoryLabels[key]}
                      </span>
                      <span
                        className={cn(
                          "max-w-28 text-right text-xs text-muted-foreground",
                          (category.state === "failed" ||
                            category.state === "partial") &&
                            "text-warning",
                        )}
                      >
                        {stateLabels[category.state]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {(state === "offline" ||
            state === "unavailable" ||
            state === "attention") && (
            <p role="status" className="text-xs text-muted-foreground">
              {activityLabels[state]}
            </p>
          )}
          {state === "reconnect" && (
            <Alert>
              <AlertDescription>
                Reconnecte Garmin pour reprendre les imports.{" "}
                <Link className="underline" href="/settings/connections/garmin">
                  Ouvrir les connexions
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {observation && (
            <dl className="flex flex-col gap-2 text-xs text-muted-foreground">
              {garminSyncCategories.map((key) => {
                const category = observation.sync.categories[key];
                return category.lastSuccessAt ? (
                  <div key={key} className="flex justify-between gap-4">
                    <dt>{categoryLabels[key]}</dt>
                    <dd>{date.format(new Date(category.lastSuccessAt))}</dd>
                  </div>
                ) : null;
              })}
              {observation.sync.categories.activities.activityCount !==
                null && (
                <div className="flex justify-between gap-4">
                  <dt>Activités importées</dt>
                  <dd>
                    {observation.sync.categories.activities.activityCount.toLocaleString(
                      "fr-FR",
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div className="flex flex-col gap-3">
            <Button variant="outline" disabled className="w-full">
              {state === "syncing"
                ? "Synchronisation en cours…"
                : "Synchronisation automatique"}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Stride lit Garmin. Il ne publie jamais sur Garmin.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              La synchronisation manuelle n’est pas encore disponible.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DataActivityThread({ className }: { className?: string }) {
  const activity = useDataActivity();
  if (!activity?.thread) return null;
  return (
    <div
      data-testid="data-activity-thread"
      role="status"
      aria-label="Chargement des données en cours"
      className={cn(
        "pointer-events-none absolute inset-x-0 -bottom-px z-10 h-0.5 overflow-hidden bg-border-subtle",
        className,
      )}
    >
      <div className="h-full w-full bg-provider/60 motion-safe:w-[28%] motion-safe:animate-trace motion-safe:bg-linear-to-r motion-safe:from-transparent motion-safe:via-provider motion-safe:to-transparent" />
    </div>
  );
}

export function DataActivityFeedback() {
  const activity = useDataActivity();
  if (!activity) return null;
  return (
    <>
      {activity.fresh.length > 0 && (
        <div
          role="status"
          className="absolute right-4 bottom-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border border-border-strong bg-surface-raised py-1 pr-1 pl-3 text-xs md:top-2 md:right-5 md:bottom-auto"
        >
          <PulseDot tone="provider" breathing={false} />
          <span className="min-w-0 truncate">Nouvelles données Garmin</span>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={activity.state === "offline"}
            onClick={activity.apply}
          >
            Afficher
          </Button>
        </div>
      )}
      {activity.state === "reconnect" && (
        <div className="mx-4 mt-2 shrink-0">
          <Alert>
            <AlertDescription>
              Garmin doit être reconnecté.{" "}
              <Link href="/settings/connections/garmin" className="underline">
                Reconnecter Garmin
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}

export function DataCategoryScope({
  categories,
  children,
  className,
}: {
  categories: GarminSyncCategory[];
  className?: string;
  children: React.ReactNode;
}) {
  const activity = useDataActivity();
  const stale =
    activity?.state === "syncing" &&
    categories.some((key) => {
      const state = activity.observation?.sync.categories[key].state;
      return state === "pending" || state === "running" || state === "partial";
    });
  return (
    <div
      data-stale={stale ? "true" : undefined}
      className={cn(
        "relative min-h-0 min-w-0",
        stale &&
          "[&_.font-metric]:opacity-50 [&_[data-slot=metric]]:opacity-50",
        className,
      )}
    >
      {stale && (
        <p
          role="status"
          className="absolute -top-4 right-0 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <PulseDot tone="provider" />
          Mise à jour…
        </p>
      )}
      {children}
    </div>
  );
}
