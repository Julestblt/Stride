import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  SettingsGroup,
  SettingsHeading,
} from "@/features/settings/components/settings-shell";
import { requireAthlete } from "@/server/app/session";
import { readStoredCounts } from "@/server/settings/data";

export default async function PrivacySettingsPage() {
  const context = await requireAthlete();
  const counts = await readStoredCounts(context);
  return (
    <>
      <SettingsHeading
        title="Data and privacy"
        description="Review what Stride currently stores for your account and download a copy of your settings data."
      />
      <SettingsGroup title="Stored in Stride">
        <div className="border-b border-border p-4 md:px-0">
          <strong className="text-sm">
            Garmin activities and observations
          </strong>
          <p className="mt-1 text-sm text-muted">
            {counts.activities ?? "Unknown number of"} activities and{" "}
            {counts.observations ?? "an unknown number of"} health observations
            are stored in your account.
          </p>
        </div>
        <div className="p-4 md:px-0">
          <strong className="text-sm">
            Profile, training preferences, goals and races
          </strong>
          <p className="mt-1 text-sm text-muted">
            Your answers are stored in your account and remain available after
            sign in.
          </p>
        </div>
      </SettingsGroup>
      <SettingsGroup title="Your copy">
        <div className="flex flex-wrap items-center gap-4 p-4 md:px-0">
          <div className="flex-1">
            <strong className="text-sm">Download settings data</strong>
            <p className="mt-1 text-sm text-muted">
              Profile, goal and race records as JSON. Garmin activity export is
              not included.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/export">Download JSON</Link>
          </Button>
        </div>
      </SettingsGroup>
      <section
        aria-labelledby="deletion-heading"
        className="overflow-hidden rounded-surface border border-danger-border bg-danger-surface/40"
      >
        <h2
          id="deletion-heading"
          className="border-b border-danger-border px-4 py-4 font-mono text-label tracking-wider text-danger uppercase md:px-5"
        >
          Deletion
        </h2>
        <div className="flex flex-wrap items-center gap-4 border-b border-danger-border px-4 py-5 md:px-5">
          <div className="flex-1">
            <strong className="text-sm">Delete imported Garmin data</strong>
            <p className="mt-1 text-sm text-muted">
              This action is unavailable while the integration has no deletion
              contract.
            </p>
          </div>
          <Button type="button" variant="destructive" disabled>
            Unavailable
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 py-5 md:px-5">
          <div className="flex-1">
            <strong className="text-sm">Delete account</strong>
            <p className="mt-1 text-sm text-muted">
              Account deletion is unavailable in Settings. Request help from the
              Stride team through the existing support channel.
            </p>
          </div>
          <Button type="button" variant="destructive" disabled>
            Unavailable
          </Button>
        </div>
      </section>
    </>
  );
}
