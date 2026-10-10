"use client";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SourceMark } from "@/components/stride/marks";
import { StrideMark } from "@/components/stride/stride-mark";
import {
  formatHours,
  type AthleteProfileView,
  type ProfileFact,
  type WeekBar,
} from "@/features/onboarding/athlete-profile";
import type { OnboardingStep } from "@/features/onboarding/progress";
import { cn } from "@/lib/utils";
import {
  completeOnboarding,
  navigateOnboarding,
} from "@/server/onboarding/actions";
import { InsightsCard, useImportInsights } from "./insights-card";
import { OnboardingActions } from "./onboarding-actions";
import { useOnboardingTransition } from "./use-onboarding-transition";

const integer = new Intl.NumberFormat("fr-FR");
const weekLabel = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const corrections: { step: OnboardingStep; label: string }[] = [
  { step: "about", label: "Mes réponses sur moi" },
  { step: "goals", label: "Mes objectifs et courses" },
  { step: "garmin", label: "Ma connexion Garmin" },
];

export function ProfileStep({
  profile,
  revision,
}: {
  profile: AthleteProfileView;
  revision: number;
}) {
  const { pending, message, run } = useOnboardingTransition();
  const insights = useImportInsights("profile", profile.habits);
  const habits = insights
    ? {
        final: true,
        items: insights.items.filter(
          (item) => item.key === "volume" || item.key === "mix",
        ),
      }
    : null;
  const [training, ...others] = profile.sections;
  const complete = () =>
    run(
      () => completeOnboarding({ step: "profile", revision }),
      "L’enregistrement a échoué. Réessaie dans un instant.",
    );
  const correct = (step: OnboardingStep) =>
    run(
      () => navigateOnboarding({ step, revision }),
      "La navigation a échoué. Réessaie dans un instant.",
    );
  return (
    <div className="flex flex-1 flex-col gap-8 motion-safe:animate-rise lg:gap-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="flex max-w-176 flex-col gap-3">
          <p className="font-mono text-label text-muted-foreground uppercase">
            Profil d’athlète · première version
          </p>
          <h1 className="text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance lg:text-[2.75rem]">
            Voici ce que je sais de toi
            {profile.firstName ? `, ${profile.firstName}` : ""}.
          </h1>
          <p className="text-body text-pretty text-muted lg:text-lead">
            Construit à partir de {integer.format(profile.activityCount)}{" "}
            activités
            {profile.history ? ` sur ${profile.history}` : ""}
            {profile.sleepNights > 0
              ? `, ${profile.sleepNights} nuits de sommeil récentes`
              : ""}{" "}
            et tes réponses. C’est un point de départ — je l’affine à chaque
            sortie, et tu peux tout corriger.
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:items-end">
          <dl className="flex gap-8">
            <Total
              label="Activités · tous sports"
              value={integer.format(profile.activityCount)}
            />
            {profile.history && (
              <Total label="Historique" value={profile.history} />
            )}
          </dl>
          <Legend />
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-10">
        <Section title={training.title}>
          <WeeklyBars weeks={profile.weeks} />
          <Facts facts={training.facts} />
        </Section>
        {others.map((section) => (
          <Section key={section.key} title={section.title}>
            <Facts facts={section.facts} />
          </Section>
        ))}
        <Section title="Zones de FC">
          {profile.heartRateZones ? (
            <>
              <dl className="flex flex-col">
                {profile.heartRateZones.zones.map((zone) => (
                  <div
                    key={zone.zone}
                    className="flex justify-between gap-4 border-b border-border py-3"
                  >
                    <dt>Zone {zone.zone}</dt>
                    <dd className="font-metric font-semibold">
                      {zone.lower}–{zone.upper} bpm
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted">
                {profile.heartRateZones.method === "karvonen"
                  ? `Estimation Stride · Karvonen (réserve cardiaque). FC max observée : ${profile.heartRateZones.maximum} bpm. FC au repos : ${profile.heartRateZones.resting} bpm, médiane de ${profile.heartRateZones.restingSamples} observations Garmin du ${profile.heartRateZones.windowStart} au ${profile.heartRateZones.windowEnd}.`
                  : `Estimation Stride · Pourcentage de la FC max observée (${profile.heartRateZones.maximum} bpm). Karvonen nécessite au moins sept observations récentes de FC au repos ; cette base n’est pas encore disponible.`}
              </p>
              <p className="text-meta text-muted-foreground">
                Activités Garmin · 12 derniers mois. Bornes : 50/60/70/80/90/100
                %. La FC max observée n’est pas un maximum physiologique mesuré.
                Ces zones estimées ne proviennent pas des réglages Garmin.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              Les zones ne sont pas disponibles sans FC max observée valide.
            </p>
          )}
        </Section>
        <InsightsCard
          insights={habits}
          title="Habitudes que je garde en tête"
          footer="Activités Garmin · tous sports sur les 12 derniers mois. Cette fenêtre diffère du résumé de course à pied sur 16 semaines."
          unavailable="Pas encore assez de données pour décrire tes habitudes d’entraînement."
        />
      </div>
      <section
        aria-labelledby="next-title"
        className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 lg:p-7"
      >
        <div className="flex gap-3">
          <StrideMark className="mt-1 size-4" />
          <div className="flex flex-col gap-1.5">
            <h2 id="next-title" className="text-body font-semibold">
              Ensuite : ton premier plan
            </h2>
            <p className="text-sm text-muted">
              Je préparerai tes premières semaines à partir de ce profil. Tu
              valides avant que quoi que ce soit soit planifié.
            </p>
          </div>
        </div>
        <div className="hidden flex-wrap items-center gap-3 lg:flex">
          <ProfileActions
            message={message}
            pending={pending}
            onComplete={complete}
            onCorrect={correct}
          />
        </div>
      </section>
      <OnboardingActions className="static lg:hidden">
        <ProfileActions
          message={message}
          pending={pending}
          onComplete={complete}
          onCorrect={correct}
        />
      </OnboardingActions>
    </div>
  );
}

function ProfileActions({
  message,
  pending,
  onComplete,
  onCorrect,
}: {
  message: string | null;
  pending: boolean;
  onComplete: () => void;
  onCorrect: (step: OnboardingStep) => void;
}) {
  return (
    <>
      {message && (
        <p role="alert" className="text-sm text-warning lg:basis-full">
          {message}
        </p>
      )}
      <Button
        className="w-full lg:w-auto lg:px-5.5"
        disabled={pending}
        aria-busy={pending}
        onClick={onComplete}
      >
        Entrer dans Stride
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full lg:w-auto"
            disabled={pending}
          >
            Corriger quelque chose
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {corrections.map((item) => (
            <DropdownMenuItem
              key={item.step}
              onSelect={() => onCorrect(item.step)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 lg:items-end">
      <dd className="font-metric text-metric-lg font-semibold">{value}</dd>
      <dt className="order-last font-mono text-nano text-muted-foreground uppercase">
        {label}
      </dt>
    </div>
  );
}

function Legend() {
  return (
    <ul
      aria-label="Sources"
      className="flex gap-4 font-mono text-nano text-muted-foreground uppercase"
    >
      <li className="flex items-center gap-1.5">
        <SourceMark source="provider" />
        Garmin
      </li>
      <li className="flex items-center gap-1.5">
        <SourceMark source="manual" />
        Toi
      </li>
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <h2 className="text-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Facts({ facts }: { facts: ProfileFact[] }) {
  return (
    <dl className="flex flex-col">
      {facts.map((fact) => (
        <div
          key={fact.key}
          className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-border py-3"
        >
          <dt className="text-sm">{fact.label}</dt>
          <dd
            className={cn(
              "text-right",
              fact.value
                ? "font-metric text-metric-sm font-semibold"
                : "text-sm text-muted-foreground",
            )}
          >
            {fact.value ?? "Pas encore disponible"}
          </dd>
          <dd className="col-span-2 flex items-center gap-1.5 font-mono text-nano text-muted-foreground uppercase">
            <SourceMark
              source={fact.source === "garmin" ? "provider" : "manual"}
            />
            <span className="sr-only">
              {fact.source === "garmin" ? "Source Garmin : " : "Ta réponse : "}
            </span>
            {fact.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function WeeklyBars({ weeks }: { weeks: WeekBar[] }) {
  const max = Math.max(...weeks.map((week) => week.hours), 1);
  if (weeks.every((week) => week.hours === 0)) return null;
  return (
    <figure className="flex flex-col gap-2">
      <ol
        aria-label="Heures de course à pied par semaine, 16 dernières semaines"
        className="flex h-14 items-end gap-0.5"
      >
        {weeks.map((week) => {
          const label = `Semaine du ${weekLabel.format(new Date(`${week.weekStart}T00:00:00Z`))} : ${formatHours(week.hours)}, ${week.activities} séance${week.activities > 1 ? "s" : ""}`;
          return (
            <li
              key={week.weekStart}
              tabIndex={0}
              aria-label={label}
              className="group/bar relative flex h-full flex-1 items-end rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="w-full rounded-t-[4px] bg-provider/80 transition-colors group-hover/bar:bg-provider group-focus-visible/bar:bg-provider"
                style={{
                  height: `${Math.max(week.hours > 0 ? 6 : 0, (week.hours / max) * 100)}%`,
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-control border border-border bg-surface-raised px-2 py-1 text-xs whitespace-nowrap group-hover/bar:block group-focus-visible/bar:block"
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className="flex justify-between font-mono text-nano text-muted-foreground uppercase">
        <span>Il y a 16 semaines</span>
        <span>Cette semaine</span>
      </figcaption>
    </figure>
  );
}
