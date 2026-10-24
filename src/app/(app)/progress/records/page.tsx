import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { localToday } from "@/features/app-shell/shell";
import {
  MarkersSection,
  ReachSection,
  RecordList,
} from "@/features/progress/components/records-sections";
import { addDays } from "@/features/progress/period";
import { garminPredictions } from "@/features/progress/garmin-predictions";
import { goalCard, preparationWindowDays } from "@/features/progress/goal";
import { fitnessRecords } from "@/features/progress/records";
import { recordsView } from "@/features/progress/records-view";
import { requireAthlete } from "@/server/app/session";
import { loadRecords } from "@/server/progress/records";

export const metadata: Metadata = { title: "Records · Progression" };

const titleClass =
  "text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[40px] sm:leading-[1.08] sm:tracking-[-0.03em]";

export default async function ProgressRecordsPage() {
  const context = await requireAthlete();
  const today = localToday(new Date());
  const loaded = await loadRecords(context, today)
    .then((data) => ({ data, failed: false }))
    .catch(() => ({ data: null, failed: true }));
  if (!loaded.data)
    return (
      <div className="flex flex-col gap-6">
        <h1 className={titleClass}>Records</h1>
        <Alert>
          <AlertDescription>
            Impossible de lire ton historique pour le moment. Réessaie plus
            tard.
          </AlertDescription>
        </Alert>
      </div>
    );
  const { model, history, threshold, goal: inputs } = loaded.data;
  const predictions = garminPredictions(loaded.data.predictions, today);
  const view = recordsView({
    model,
    predictions,
    vo2: history.vo2,
    threshold,
    today,
  });
  const recent = fitnessRecords(
    history.activities.filter(
      (activity) =>
        activity.day >= addDays(today, -preparationWindowDays) &&
        activity.day <= today,
    ),
    history.laps,
  );
  const goal = goalCard({
    races: inputs.races,
    primaryRaceId: inputs.primaryRaceId,
    today,
    predictions,
    longestRunMeters: recent.longest?.meters ?? null,
    maxWeeklyGainMeters: recent.weeklyGain?.meters ?? null,
    preparation: inputs.preparation,
    program: null,
    blockKinds: {},
  });
  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <section className="grid items-start gap-6.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-2.5 sm:gap-3.5">
          <h1 className={titleClass}>{view.headline}</h1>
          <p className="max-w-150 text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
            {view.paragraph}
          </p>
        </div>
        <ReachSection reach={view.reach} goal={goal} />
      </section>
      <MarkersSection markers={view.markers} />
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
        <RecordList
          id="records-speed"
          title="Vitesse"
          rows={view.speed}
          empty="Aucun record sur route documenté."
        />
        <RecordList
          id="records-endurance"
          title="Endurance"
          rows={view.endurance}
          empty="Aucun record d’endurance documenté."
        />
      </div>
      <p className="text-xs leading-normal text-muted-foreground">
        Records tirés de tes tours et tracés Garmin, sans dépasser la distance
        de plus de 5 %. Vitesse : sorties sur route et piste uniquement.
        Prévisions : Garmin. Chaque ligne ouvre l’activité d’origine.
      </p>
    </div>
  );
}
