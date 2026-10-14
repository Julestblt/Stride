import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StrideMark } from "@/components/stride/stride-mark";
import { formatLocalDate, localToday } from "@/features/app-shell/shell";
import {
  athleteModelShares,
  formatMemberSince,
} from "@/features/settings/athlete-model";
import { cn } from "@/lib/utils";
import { ageOn } from "@/features/settings/age";
import {
  SettingsGroup,
  SettingsLinkRow,
} from "@/features/settings/components/settings-shell";
import { loadAthleteProfile } from "@/server/onboarding/athlete-profile";
import { readProfile } from "@/server/onboarding/profile";
import { readGoals } from "@/server/onboarding/goals";
import { requireAthlete } from "@/server/app/session";
import { getShell } from "@/server/app/shell";
import { signOut } from "@/server/auth/actions";

export default async function SettingsOverviewPage() {
  const context = await requireAthlete();
  const [profile, goals, shell, athleteProfile] = await Promise.all([
    readProfile(context),
    readGoals(context),
    getShell(),
    loadAthleteProfile(context, new Date()),
  ]);
  const races = goals.races
    .filter((item) => item.values.name)
    .toSorted((a, b) =>
      (a.values.race_date ?? "9999").localeCompare(
        b.values.race_date ?? "9999",
      ),
    )
    .map((item) => `${item.values.name} (${item.values.priority})`);
  const age = ageOn(profile.values.birth_date, localToday(new Date()));
  const days = profile.values.available_weekdays?.length;
  const shares = athleteModelShares(athleteProfile, profile.values);
  const updated = formatLocalDate(profile.updatedAt);
  const memberSince = formatMemberSince(context.createdAt ?? null);
  const segments = [
    {
      key: "garmin",
      share: shares.garmin,
      source: shares.garmin,
      label: "signaux Garmin",
      className: "bg-provider",
    },
    {
      key: "athlete",
      share: shares.athlete,
      source: shares.athlete,
      label: "de ta part",
      className: "bg-foreground",
    },
    {
      key: "estimate",
      share: shares.estimate,
      source: shares.estimate,
      label: "estimations Stride",
      className: "bg-accent",
    },
  ];
  return (
    <>
      <div className="mb-5 flex items-center gap-4 md:mb-8">
        <span className="grid size-14 place-items-center rounded-surface bg-surface-raised font-semibold">
          {shell.athlete.initials}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-xl">
            {shell.athlete.name}
          </strong>
          <span className="block truncate text-sm text-muted">
            {context.email}
            {memberSince && (
              <span className="hidden md:inline">
                {" "}
                · membre depuis {memberSince}
              </span>
            )}
          </span>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
          className="hidden md:block"
        >
          <Button type="submit" variant="outline">
            Se déconnecter
          </Button>
        </form>
      </div>
      <div className="mb-6 flex flex-col gap-2 rounded-surface border border-border bg-surface p-4 md:mb-10 md:gap-4 md:px-6 md:py-5.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <StrideMark className="hidden md:block" />
            <h2 className="text-sm font-semibold md:text-lg">
              <span className="md:hidden">Modèle d’athlète</span>
              <span className="hidden md:inline">Ton modèle d’athlète</span>
            </h2>
          </div>
          {updated && (
            <span className="hidden text-sm text-muted md:block">
              Mis à jour le {updated}
            </span>
          )}
          {shares.openQuestions > 0 && (
            <Link
              href="/settings/profile"
              className="text-sm font-medium text-accent hover:underline md:hidden"
            >
              {shares.openQuestions} question
              {shares.openQuestions > 1 ? "s" : ""}
            </Link>
          )}
        </div>
        <p className="hidden max-w-160 text-sm leading-normal text-muted md:block">
          Garmin fournit les signaux. Stride en tire ton modèle, avec tes
          réponses, tes objectifs et ta façon de réagir à l’entraînement.
        </p>
        <div
          role="img"
          aria-label={`${shares.garmin} % signaux Garmin, ${shares.athlete} % de ta part, ${shares.estimate} % estimations Stride`}
          className="flex h-2 gap-0.5 md:h-2.5"
        >
          {segments.map(({ key, share, className }) => (
            <span
              key={key}
              style={{ flexGrow: share }}
              className={cn(
                "basis-0 first:rounded-l-xs last:rounded-r-xs",
                className,
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground md:hidden">
          Garmin {shares.garmin} % · toi {shares.athlete} % · estimations Stride{" "}
          {shares.estimate} %
        </p>
        <div className="hidden flex-wrap gap-x-5 gap-y-2 md:flex">
          {segments.map(({ key, label, className, source }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={cn("size-2 rounded-xs", className)} />
              {source} % {label}
            </span>
          ))}
          {shares.openQuestions > 0 && (
            <Link
              href="/settings/profile"
              className="ml-auto text-sm font-medium text-accent hover:underline"
            >
              {shares.openQuestions} question
              {shares.openQuestions > 1
                ? "s l’affineraient"
                : " l’affinerait"}{" "}
              →
            </Link>
          )}
        </div>
      </div>
      <SettingsGroup title="Toi">
        <SettingsLinkRow
          href="/settings/profile"
          title="Profil"
          detail={
            [
              profile.values.height_cm && `${profile.values.height_cm} cm`,
              profile.values.weight_kg && `${profile.values.weight_kg} kg`,
              age !== null && `${age} ans`,
            ]
              .filter(Boolean)
              .join(" · ") || "Renseigner mon profil"
          }
        />
        <SettingsLinkRow
          href="/settings/training"
          title="Entraînement et coach"
          detail={
            days ? `${days} jours par semaine` : "Renseigner mes disponibilités"
          }
        />
        <SettingsLinkRow
          href="/settings/goals"
          title="Objectifs et courses"
          detail={races.join(" · ") || "Aucune course"}
        />
        <SettingsLinkRow
          href="/settings/training#notifications"
          title="Notifications"
          detail="Indisponibles pour le moment"
        />
      </SettingsGroup>
      <SettingsGroup title="Données">
        <SettingsLinkRow
          href="/settings/connections"
          title="Connexions"
          detail="Garmin"
        />
        <SettingsLinkRow
          href="/settings/privacy"
          title="Données et confidentialité"
          detail="Données enregistrées et export"
        />
      </SettingsGroup>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
        className="fixed right-4 bottom-4 left-4 md:hidden"
      >
        <Button type="submit" variant="outline" className="w-full">
          Se déconnecter
        </Button>
      </form>
    </>
  );
}
