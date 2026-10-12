import type { Metadata } from "next";
import { localToday } from "@/features/app-shell/shell";
import { CheckinCard } from "@/features/progress/components/checkin-card";
import {
  MissingCard,
  PlanChangesSection,
  RangeCard,
  ReadinessSection,
  SleepCard,
} from "@/features/progress/components/recovery-sections";
import { recoveryView } from "@/features/progress/recovery-view";
import { requireAthlete } from "@/server/app/session";
import { loadRecovery } from "@/server/progress/recovery";

export const metadata: Metadata = { title: "Récupération · Progression" };

export default async function ProgressRecoveryPage() {
  const context = await requireAthlete();
  const today = localToday(new Date());
  const model = await loadRecovery(context, today);
  const view = recoveryView(model);
  return (
    <div className="flex flex-col gap-6.5 sm:gap-13">
      <section className="flex max-w-205 flex-col gap-2.5 sm:gap-3">
        <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
          {view.headline}
        </h1>
        <p className="text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
          {view.summary}
        </p>
      </section>
      {view.readiness ? (
        <ReadinessSection
          readiness={view.readiness}
          deviations={view.deviations}
        />
      ) : (
        <MissingCard
          id="recovery-readiness"
          title="Forme du jour"
          message="Garmin n’a pas transmis de disponibilité pour aujourd’hui."
        />
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-x-10 gap-y-9 max-sm:divide-y max-sm:divide-border max-sm:[&>*:not(:first-child)]:pt-6.5">
        {view.sleep ? (
          <SleepCard sleep={view.sleep} />
        ) : (
          <MissingCard
            id="recovery-sleep"
            title="Sommeil"
            message="Aucune nuit mesurée par Garmin ces deux derniers jours."
          />
        )}
        {view.hrv ? (
          <RangeCard
            id="recovery-hrv"
            title="VFC nocturne"
            card={view.hrv}
            unit="ms"
            measure="VFC nocturne"
            label={`VFC nocturne des 14 dernières nuits, ${view.hrv.value} la dernière nuit${view.hrv.range ? `, plage habituelle ${view.hrv.range.low} à ${view.hrv.range.high} ms` : ""}.`}
          />
        ) : (
          <MissingCard
            id="recovery-hrv"
            title="VFC nocturne"
            message="Aucune VFC nocturne mesurée ces deux derniers jours."
          />
        )}
        {view.resting ? (
          <RangeCard
            id="recovery-resting"
            title="FC au repos"
            card={view.resting}
            unit="bpm"
            measure="FC au repos"
            label={`FC au repos sur 14 jours, ${view.resting.value} aujourd’hui${view.resting.range ? `, habituelle ${view.resting.range.low} à ${view.resting.range.high} bpm` : ""}.`}
          />
        ) : (
          <MissingCard
            id="recovery-resting"
            title="FC au repos"
            message="Aucune FC au repos mesurée ces deux derniers jours."
          />
        )}
      </div>
      <div className="flex flex-wrap items-start gap-x-14 gap-y-9">
        <CheckinCard initial={model.checkin} />
        <PlanChangesSection races={view.races} racesNote={view.racesNote} />
      </div>
    </div>
  );
}
