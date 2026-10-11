import Link from "next/link";
import { Button } from "@/components/ui/button";
import { answeredCount } from "@/features/onboarding/profile";
import { localToday } from "@/features/app-shell/shell";
import { ageOn } from "@/features/settings/age";
import {
  SettingsGroup,
  SettingsLinkRow,
} from "@/features/settings/components/settings-shell";
import { readProfile } from "@/server/onboarding/profile";
import { readGoals } from "@/server/onboarding/goals";
import { requireAthlete } from "@/server/app/session";
import { getShell } from "@/server/app/shell";
import { signOut } from "@/server/auth/actions";

export default async function SettingsOverviewPage() {
  const context = await requireAthlete();
  const [profile, goals, shell] = await Promise.all([
    readProfile(context),
    readGoals(context),
    getShell(),
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
      <div className="mb-6 rounded-surface border border-border bg-surface p-4 md:mb-10 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Ton modèle d’athlète</h2>
          <Link
            href="/settings/profile"
            className="text-sm font-medium text-accent hover:underline md:hidden"
          >
            Voir →
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted md:hidden">
          {answeredCount(profile.values)} informations enregistrées
        </p>
        <p className="mt-2 hidden text-sm text-muted md:block">
          Tes réponses et les données Garmin enregistrées aident Stride à mieux
          te connaître.
        </p>
        <Link
          href="/settings/profile"
          className="mt-4 hidden text-sm font-medium text-accent hover:underline md:inline-block"
        >
          Voir le profil →
        </Link>
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
