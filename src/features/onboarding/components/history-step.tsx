"use client";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SyncStatus } from "@/components/stride/sync-status";
import { garminSyncCategories } from "@/features/garmin/sync";
import {
  buildTimeline,
  categoryView,
  importNotice,
  isImportRunning,
  type CategoryView,
  type TimelineYear,
} from "@/features/onboarding/import-history";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/onboarding/actions";
import { OnboardingActions } from "./onboarding-actions";
import { useOnboardingStatus } from "./onboarding-status";
import { useOnboardingTransition } from "./use-onboarding-transition";

const categories = {
  activities: { title: "Activités", subtitle: "Course, trail, rando, vélo" },
  recovery: {
    title: "Récupération",
    subtitle: "Sommeil, VFC, FC au repos, stress",
  },
  fitness: {
    title: "Historique de forme",
    subtitle: "VO₂ max, charge, courses, records",
  },
  patterns: {
    title: "Habitudes d’entraînement",
    subtitle: "Comment tu t’entraînes et réagis",
  },
};
const toneClasses = {
  muted: "text-muted-foreground",
  accent: "text-foreground",
  success: "text-success",
  warning: "text-warning",
};

export function HistoryStep({
  revision,
  reconnect,
}: {
  revision: number;
  reconnect: boolean;
}) {
  const { sync } = useOnboardingStatus();
  const { pending, message, run } = useOnboardingTransition();
  const observation = sync.observation;
  const timeline = buildTimeline(observation, new Date());
  const running = isImportRunning(observation);
  const notice = importNotice(observation, {
    reconnect,
    unavailable: sync.unavailable,
  });
  const activities = observation?.categories.activities.activityCount ?? null;
  return (
    <div className="flex flex-1 flex-col gap-7 motion-safe:animate-rise lg:max-w-154 lg:gap-9">
      <div className="flex flex-col gap-3">
        <h1 className="text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
          Création de ton profil d’athlète
        </h1>
        <p className="text-body text-pretty text-muted lg:text-lead">
          <span className="hidden lg:inline">
            Je lis tout ce que Garmin a gardé, du plus récent au plus ancien,
            pour pouvoir te coacher avant l’arrivée des plus vieilles années. Un
            long historique prend du temps — inutile d’attendre ici.
          </span>
          <span className="lg:hidden">
            Lecture du plus récent au plus ancien. Tu peux continuer — je
            poursuis en arrière-plan.
          </span>
        </p>
      </div>
      <HistoryTimeline years={timeline.years} reading={timeline.reading} />
      <ul
        aria-label="Import par catégorie"
        className="flex flex-col border-t border-border"
      >
        {garminSyncCategories.map((category) => (
          <CategoryRow
            key={category}
            title={categories[category].title}
            subtitle={categories[category].subtitle}
            view={
              observation
                ? categoryView(category, observation.categories[category])
                : null
            }
          />
        ))}
      </ul>
      {notice === "paused" && (
        <SyncStatus
          state="expired"
          action={
            <Button asChild variant="outline" size="md">
              <Link href="/onboarding/garmin">Reconnecter Garmin</Link>
            </Button>
          }
        >
          <span className="font-semibold">Import en pause.</span> Garmin demande
          de se reconnecter.
          {activities !== null &&
            ` ${new Intl.NumberFormat("fr-FR").format(activities)} activités sont déjà enregistrées.`}
        </SyncStatus>
      )}
      {notice === "slow" && (
        <SyncStatus state="retrying">
          <span className="font-semibold">Garmin est lent en ce moment.</span>{" "}
          Nouvelle tentative automatique. Rien n’est perdu — continue la
          configuration.
        </SyncStatus>
      )}
      {notice === "partial" && (
        <SyncStatus state="partial">
          <span className="font-semibold">Données partielles.</span> Garmin n’a
          pas renvoyé une partie de l’historique. J’utiliserai ce qui est déjà
          importé.
        </SyncStatus>
      )}
      <OnboardingActions className="lg:flex-col lg:items-start lg:gap-3.5">
        {message && (
          <p role="alert" className="text-sm text-warning">
            {message}
          </p>
        )}
        <Button
          className="w-full lg:w-auto lg:px-5.5"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            run(
              () => completeOnboarding({ step: "history", revision }),
              "L’enregistrement a échoué. Réessaie dans un instant.",
            )
          }
        >
          {running ? "Continuer — je continue la lecture" : "Continuer"}
        </Button>
        <p className="text-center text-xs text-muted-foreground lg:text-left lg:text-meta">
          {running
            ? "La lecture continue en arrière-plan pendant que tu avances."
            : "Tout l’historique disponible est lu."}
        </p>
      </OnboardingActions>
    </div>
  );
}

function HistoryTimeline({
  years,
  reading,
}: {
  years: TimelineYear[];
  reading: string | null;
}) {
  const first = years[0]?.year;
  const last = years.at(-1)?.year;
  return (
    <section aria-label="Historique lu" className="flex flex-col gap-2.5">
      <div className="hidden items-baseline justify-between lg:flex">
        <h2 className="font-mono text-label text-muted-foreground uppercase">
          Historique lu
        </h2>
        {reading && (
          <p className="text-sm text-muted">
            Actuellement :{" "}
            <span className="font-metric font-semibold text-foreground">
              {reading}
            </span>
          </p>
        )}
      </div>
      <ol className="grid auto-cols-fr grid-flow-col gap-1 lg:gap-1.5">
        {years.map(({ year, fill }) => (
          <li key={year} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "relative h-3 overflow-hidden rounded-mark lg:h-5.5",
                fill === 0
                  ? "border border-dashed border-border-strong"
                  : "bg-surface-raised",
              )}
            >
              {fill > 0 && (
                <span
                  className="absolute inset-y-0 right-0 bg-accent"
                  style={{ width: `${Math.round(fill * 100)}%` }}
                />
              )}
            </span>
            <span
              className={cn(
                "hidden font-mono text-micro text-muted-foreground lg:block",
                fill > 0 && fill < 1 && "font-semibold text-foreground",
              )}
            >
              {year}
              <span className="sr-only">
                {fill === 1
                  ? " : lue"
                  : fill > 0
                    ? " : en cours de lecture"
                    : " : pas encore lue"}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between font-mono text-micro text-muted-foreground uppercase lg:hidden">
        <span>{first}</span>
        {reading && (
          <span className="font-semibold text-foreground">
            Actuellement : {reading}
          </span>
        )}
        <span>{last}</span>
      </div>
    </section>
  );
}

function CategoryRow({
  title,
  subtitle,
  view,
}: {
  title: string;
  subtitle: string;
  view: CategoryView | null;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5 border-b border-border py-4 lg:grid-cols-[13.5rem_1fr_6.5rem] lg:gap-x-6 lg:py-5">
      <span className="flex flex-col gap-0.5 lg:col-start-1 lg:row-start-1">
        <span className="text-body font-semibold lg:text-lead">{title}</span>
        <span className="hidden text-xs text-muted-foreground lg:block">
          {subtitle}
        </span>
      </span>
      <span className="col-span-2 row-start-2 flex flex-col gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <span
          aria-hidden="true"
          className="relative h-1 overflow-hidden rounded-mark bg-border"
        >
          {view?.bar === "active" && (
            <>
              <span className="absolute inset-y-0 left-0 w-[30%] bg-linear-to-r from-transparent via-accent to-transparent motion-safe:animate-trace motion-reduce:hidden" />
              <span className="absolute inset-y-0 left-0 hidden w-1/3 bg-accent/60 motion-reduce:block" />
            </>
          )}
          {view?.bar === "full" && (
            <span className="absolute inset-0 bg-foreground" />
          )}
          {view?.bar === "attention" && (
            <span className="absolute inset-0 bg-warning/60" />
          )}
        </span>
        <span className="hidden text-sm text-muted lg:block">
          {view?.detail ?? "Lecture du statut Garmin…"}
        </span>
      </span>
      <span
        className={cn(
          "flex items-center justify-end gap-1.5 text-right lg:col-start-3 lg:row-start-1",
          view && view.tone !== "accent" && toneClasses[view.tone],
          view?.value.match(/^\d/)
            ? "font-metric text-metric font-semibold text-foreground"
            : "text-sm",
        )}
      >
        {view?.tone === "success" && (
          <CheckIcon aria-hidden="true" className="size-3.5" />
        )}
        {view?.value.match(/^\d/) ? (
          <>
            {view.value}
            <span className="sr-only"> activités</span>
          </>
        ) : (
          (view?.value ?? "…")
        )}
      </span>
    </li>
  );
}
