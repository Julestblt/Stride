import type { Metadata } from "next";
import { MonoLabel } from "@/components/stride/mono-label";
import { formatRecordDate } from "@/features/progress/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { localToday } from "@/features/app-shell/shell";
import { RecordsChronology } from "@/features/progress/components/records-charts";
import { RoadRecords } from "@/features/progress/components/records-road";
import {
  EnduranceRecords,
  RecordsFilters,
  RecordsOpportunities,
  RecordsReading,
} from "@/features/progress/components/records-sections";
import {
  parseRecordFilter,
  recordsView,
} from "@/features/progress/records-view";
import { requireAthlete } from "@/server/app/session";
import { loadRecords } from "@/server/progress/records";

export const metadata: Metadata = { title: "Records · Progression" };
export default async function ProgressRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const filter = parseRecordFilter(query.filter),
    today = localToday(new Date());
  const loaded = await loadRecords(context, today)
    .then((data) => ({ data, failed: false }))
    .catch(() => ({ data: null, failed: true }));
  const latest = loaded.data?.model.chronology.at(-1);
  const header = (
    <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <h1 className="text-[25px] leading-tight font-semibold tracking-tight max-sm:sr-only sm:text-[46px]">
        Records
      </h1>
      <div className="flex items-center gap-4 max-sm:w-full">
        {latest && (
          <MonoLabel size="nano" className="max-lg:hidden">
            Dernier record · {formatRecordDate(latest.day)}
          </MonoLabel>
        )}
        <RecordsFilters filter={filter} />
      </div>
    </section>
  );
  if (!loaded.data)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Alert>
          <AlertDescription>
            Impossible de lire ton historique pour le moment. Réessaie plus
            tard.
          </AlertDescription>
        </Alert>
      </div>
    );
  const { model, history } = loaded.data,
    view = recordsView(model, history, today, filter);
  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      {header}
      <RecordsReading view={view} />
      <RecordsChronology view={view} />
      {filter !== "trail" && <RoadRecords model={model} view={view} />}
      {filter !== "road" && <EnduranceRecords model={model} />}
      <RecordsOpportunities view={view} />
      <p className="text-xs leading-normal text-muted-foreground">
        Records recalculés par Stride à partir de l’historique Garmin importé.
        Les activités datées après aujourd’hui sont exclues. Les semaines
        commencent le lundi. VAM : estimation sur 20 minutes de montée continue,
        pente moyenne de 12 à 16 %, sans intervalle entre échantillons supérieur
        à 5 minutes. Les estimations de course utilisent une VO₂ max Garmin
        observée dans les 30 derniers jours ; aucun résultat de course ni record
        officiel Garmin n’est importé.
      </p>
    </div>
  );
}
