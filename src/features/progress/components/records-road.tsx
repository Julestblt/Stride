import { ChevronRightIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { ConfidenceMeter } from "@/components/stride/confidence-meter";
import { StrideMark } from "@/components/stride/stride-mark";
import { MonoLabel } from "@/components/stride/mono-label";
import { ProvenanceLabel } from "@/components/stride/provenance";
import { formatClock, formatRecordDate, formatPace } from "../format";
import type { RecordsModel } from "../record-history";
import {
  recordConfidenceLabels,
  recordCount,
  type RecordsView,
} from "../records-view";
import { RoadHistoryChart } from "./records-charts";

export function RoadRecords({
  model,
  view,
}: {
  model: RecordsModel;
  view: RecordsView;
}) {
  return (
    <section
      aria-labelledby="records-road"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="records-road" className="text-lead font-semibold">
          Route
        </h2>
        <ProvenanceLabel source="estimate">
          Estimations Stride · données Garmin
        </ProvenanceLabel>
      </div>
      <p className="text-xs text-muted-foreground">
        Meilleurs efforts sur route et piste, recalculés depuis les activités
        importées.
      </p>
      <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_minmax(0,1.6fr)_12rem_2rem] gap-4 px-4 sm:grid">
        <MonoLabel size="nano">Distance</MonoLabel>
        <MonoLabel size="nano">Record</MonoLabel>
        <MonoLabel size="nano">Allure</MonoLabel>
        <MonoLabel size="nano">Date · activité</MonoLabel>
        <MonoLabel size="nano">Estimation Stride</MonoLabel>
      </div>
      <div className="flex flex-col gap-1.5">
        {model.road.map((record) => {
          const current = record.current,
            prediction = view.predictions.find((p) => p.key === record.key);
          return (
            <details
              key={record.key}
              className="group min-w-0 rounded-card border border-border bg-surface"
            >
              <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-1 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_7rem_6rem_minmax(0,1.6fr)_12rem_2rem] sm:gap-x-4">
                <span className="text-sm font-semibold">{record.label}</span>
                <span className="text-right font-metric text-metric-lg font-semibold tabular-nums sm:text-left">
                  {current ? formatClock(current.value) : "—"}
                </span>
                <span className="hidden text-xs text-muted sm:block">
                  {current
                    ? `${formatPace(current.value / (record.meters / 1000))}/km`
                    : "—"}
                </span>
                <span className="min-w-0 text-xs text-muted max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-2">
                  {current ? (
                    <>
                      {formatRecordDate(current.day)}
                      <span className="sm:hidden">
                        {" "}
                        · {formatPace(current.value / (record.meters / 1000))}
                        /km
                      </span>
                      <span className="hidden truncate sm:block">
                        {current.name}
                      </span>
                    </>
                  ) : (
                    "Aucun effort documenté"
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs whitespace-nowrap text-muted max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-3">
                  {prediction ? (
                    <>
                      <span className="sm:hidden">prév.</span>
                      <span className="font-metric text-sm font-semibold tabular-nums sm:text-metric-sm">
                        {formatClock(prediction.seconds)}
                      </span>
                      {prediction.gap !== null && (
                        <span className="text-warning">
                          {prediction.gap >= 0 ? "+" : "−"}
                          {Math.round(Math.abs(prediction.gap))} s
                        </span>
                      )}
                      <ConfidenceMeter
                        level={prediction.confidence}
                        label={recordConfidenceLabels[prediction.confidence]}
                        hideLabel
                      />
                    </>
                  ) : (
                    "Pas d’estimation"
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="col-start-3 row-span-3 row-start-1 grid size-8 place-items-center self-center justify-self-end rounded-control border border-border text-muted-foreground sm:col-start-6 sm:row-span-1"
                >
                  <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                </span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-border p-4">
                <MonoLabel size="nano">
                  Historique du record ·{" "}
                  {recordCount(record.history.length, "repère")}
                </MonoLabel>
                {current ? (
                  <>
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                      <RoadHistoryChart
                        points={record.history}
                        label={record.label}
                      />
                      <div className="flex flex-col gap-3">
                        <p className="flex gap-2 rounded-surface bg-surface-inset p-3 text-meta leading-normal text-muted">
                          <StrideMark className="mt-1 size-3 shrink-0" />
                          <span>
                            {record.history.length > 1
                              ? `Ton temps a progressé de ${formatClock(record.history[0].value - current.value)} depuis ton premier repère importé.`
                              : "Ce temps est ton premier repère documenté sur cette distance."}{" "}
                            {prediction?.gap !== null &&
                            prediction?.gap !== undefined
                              ? `L’estimation Stride actuelle se situe à ${Math.round(Math.abs(prediction.gap))} s ${prediction.gap >= 0 ? "au-dessus" : "en dessous"} de ce record.`
                              : "Aucune estimation récente ne permet de situer ce record aujourd’hui."}
                          </span>
                        </p>
                        <Link
                          className="text-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                          href={`/activities/${current.activityId}`}
                        >
                          Ouvrir l’activité du record →
                        </Link>
                      </div>
                    </div>
                    <details className="text-xs text-muted">
                      <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
                        Dates et activités de tous les repères
                      </summary>
                      <ul className="mt-3 flex flex-col gap-2">
                        {record.history.map((p) => (
                          <li
                            key={`${p.day}-${p.activityId}`}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"
                          >
                            <span>
                              {formatRecordDate(p.day)} · {formatClock(p.value)}{" "}
                              · estimation Stride
                            </span>
                            <Link
                              className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                              href={`/activities/${p.activityId}`}
                            >
                              {p.name} →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    Distance, durée ou tours consécutifs insuffisants pour
                    établir ce record.
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
      {view.forecast && (
        <ProvenanceLabel source="estimate" variant="mono">
          VO₂ max Garmin observée le{" "}
          {formatRecordDate(view.forecast.observedOn)} · estimations Stride
        </ProvenanceLabel>
      )}
      <p className="text-xs leading-normal text-muted-foreground">
        Ce sont des efforts estimés, pas des records officiels Garmin. La
        distance observée dépasse la distance cible de 5 % maximum, puis le
        temps est ramené à la distance exacte. Prévisions sur route plate :
        confiance modérée sur 5 km, 10 km et semi-marathon, faible sur marathon.
      </p>
    </section>
  );
}
