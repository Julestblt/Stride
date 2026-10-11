import Link from "next/link";
import { Button } from "@/components/ui/button";
import { answeredCount } from "@/features/onboarding/profile";
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
  const race = goals.races.find(
    (item) => item.values.priority === "A" && item.values.name,
  )?.values.name;
  const days = profile.values.available_weekdays?.length;
  return (
    <>
      <div className="mb-5 flex items-center gap-4 md:mb-8">
        <span className="grid size-14 place-items-center rounded-surface bg-surface-raised font-semibold">
          {shell.athlete.initials}
        </span>
        <div className="min-w-0">
          <strong className="block truncate text-xl">
            {shell.athlete.name}
          </strong>
          <span className="block truncate text-sm text-muted">
            {context.email}
          </span>
        </div>
      </div>
      <div className="mb-6 rounded-surface border border-border bg-surface p-4 md:mb-10 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Your athlete profile</h2>
          <Link
            href="/settings/profile"
            className="text-sm font-medium text-accent hover:underline md:hidden"
          >
            Review →
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted md:hidden">
          {answeredCount(profile.values)} details saved
        </p>
        <p className="mt-2 hidden text-sm text-muted md:block">
          Your answers and recorded Garmin data shape what Stride knows about
          you.
        </p>
        <Link
          href="/settings/profile"
          className="mt-4 hidden text-sm font-medium text-accent hover:underline md:inline-block"
        >
          Review profile →
        </Link>
      </div>
      <SettingsGroup title="You">
        <SettingsLinkRow
          href="/settings/profile"
          title="Profile"
          detail={
            [
              profile.values.height_cm && `${profile.values.height_cm} cm`,
              profile.values.weight_kg && `${profile.values.weight_kg} kg`,
            ]
              .filter(Boolean)
              .join(" · ") || "Review details"
          }
        />
        <SettingsLinkRow
          href="/settings/training"
          title="Training"
          detail={days ? `${days} days per week` : "Set your availability"}
        />
        <SettingsLinkRow
          href="/settings/goals"
          title="Goals and races"
          detail={race ?? `${goals.races.length} races`}
        />
      </SettingsGroup>
      <SettingsGroup title="Data">
        <SettingsLinkRow
          href="/settings/connections"
          title="Connections"
          detail="Garmin"
        />
        <SettingsLinkRow
          href="/settings/privacy"
          title="Data and privacy"
          detail="Stored data and your copy"
        />
      </SettingsGroup>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
        className="md:hidden"
      >
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </>
  );
}
