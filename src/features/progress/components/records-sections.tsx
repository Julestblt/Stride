import Link from "next/link";
import { MonoLabel } from "@/components/stride/mono-label";
import { Metric } from "@/components/stride/metric";
import { ProvenanceLabel } from "@/components/stride/provenance";
import { StrideMark } from "@/components/stride/stride-mark";
import { cn } from "@/lib/utils";
import { formatRecordDate } from "../format";
import type { RecordsModel } from "../record-history";
import {
  formatEndurance,
  recordCount,
  recordFilters,
  recordFilterLabels,
  type RecordFilter,
  type RecordsView,
} from "../records-view";

export function RecordsFilters({ filter }: { filter: RecordFilter }) {
  return (
    <nav
      aria-label="Type de records"
      className="flex shrink-0 gap-0.5 rounded-surface border border-border bg-surface p-0.75 max-sm:w-full"
    >
      {recordFilters.map((value) => (
        <Link
          key={value}
          href={
            value === "all"
              ? "/progress/records"
              : `/progress/records?filter=${value}`
          }
          scroll={false}
          aria-current={filter === value ? "page" : undefined}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center rounded-control px-3 text-xs whitespace-nowrap text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring",
            value === filter &&
              "bg-surface-raised font-semibold text-foreground",
          )}
        >
          {recordFilterLabels[value]}
        </Link>
      ))}
    </nav>
  );
}
export function RecordsReading({ view }: { view: RecordsView }) {
  return (
    <section
      aria-labelledby="records-reading"
      className="grid gap-6 rounded-panel border border-border bg-surface p-5 sm:p-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-3">
        <MonoLabel size="micro" className="flex items-center gap-2">
          <StrideMark className="size-3" />
          Lecture de Stride · historique importé
        </MonoLabel>
        <h2
          id="records-reading"
          className="text-[24px] leading-[1.14] font-semibold tracking-[-0.02em] text-balance sm:text-[30px]"
        >
          {view.headline}
        </h2>
        <p className="text-sm leading-[1.6] text-pretty text-muted">
          {view.paragraph}
        </p>
      </div>
      <div>
        <MonoLabel size="micro">Ce qu’on retient</MonoLabel>
        <ul className="mt-3 flex flex-col">
          {view.takeaways.map((item) => (
            <li
              key={item.title}
              className="flex gap-3 border-t border-border py-3"
            >
              <StrideMark className="mt-1 size-3 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-meta leading-normal text-muted">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
export function EnduranceRecords({ model }: { model: RecordsModel }) {
  return (
    <section
      aria-labelledby="records-endurance"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="records-endurance" className="text-lead font-semibold">
          Trail et ultra
        </h2>
        <ProvenanceLabel source="estimate">Calculé par Stride</ProvenanceLabel>
      </div>
      <p className="text-xs text-muted-foreground">
        Distance, durée et dénivelé des courses extérieures ; volume
        hebdomadaire de toutes les courses à pied.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {model.endurance.map((record) => (
          <article
            key={record.key}
            className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-4"
          >
            <h3>
              <MonoLabel size="nano">{record.label}</MonoLabel>
            </h3>
            <Metric
              size="lg"
              className="text-[38px] sm:text-[42px]"
              value={
                record.current
                  ? formatEndurance(record, record.current.value)
                  : "—"
              }
              unit={record.key === "duration" ? undefined : record.unit}
            />
            {record.current ? (
              <>
                <p className="text-xs text-muted">
                  {record.current.name}
                  <br />
                  {formatRecordDate(record.current.day)}
                </p>
                {record.current.activityId ? (
                  <Link
                    href={`/activities/${record.current.activityId}`}
                    className="text-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Voir l’activité →
                  </Link>
                ) : (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
                      Activités de la semaine
                    </summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {record.current.activityIds?.map((id) => (
                        <li key={id}>
                          <Link
                            href={`/activities/${id}`}
                            className="underline"
                          >
                            {model.activities.find((a) => a.id === id)?.name ??
                              "Course à pied"}{" "}
                            →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <span className="text-xs text-success">
                  {recordCount(record.history.length, "repère")} dans
                  l’historique
                </span>
              </>
            ) : (
              <p className="text-xs leading-normal text-muted-foreground">
                {record.key === "vam"
                  ? "Aucune montée continue de 20 min avec une pente moyenne de 12 à 16 % et des échantillons exploitables."
                  : "Données importées insuffisantes."}
              </p>
            )}
            {record.history.length > 1 && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
                  Historique des améliorations
                </summary>
                <ul className="mt-2 flex flex-col gap-3">
                  {record.history.map((point) => (
                    <li key={`${point.day}-${point.activityId}`}>
                      <span>
                        {formatRecordDate(point.day)} ·{" "}
                        {formatEndurance(record, point.value)}{" "}
                        {record.key === "duration" ? "" : record.unit}
                      </span>
                      {point.activityId ? (
                        <Link
                          className="block underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                          href={`/activities/${point.activityId}`}
                        >
                          {point.name} →
                        </Link>
                      ) : (
                        point.activityIds?.map((id) => (
                          <Link
                            key={id}
                            className="block underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                            href={`/activities/${id}`}
                          >
                            {model.activities.find((a) => a.id === id)?.name ??
                              "Course à pied"}{" "}
                            →
                          </Link>
                        ))
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <ProvenanceLabel source="estimate" variant="mono">
              {record.key === "vam"
                ? "Estimation · traces Garmin"
                : "Calcul Stride · Garmin"}
            </ProvenanceLabel>
          </article>
        ))}
      </div>
    </section>
  );
}
export function RecordsRacesAndOpportunities({ view }: { view: RecordsView }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section aria-labelledby="records-races" className="flex flex-col gap-3">
        <h2 id="records-races" className="text-lead font-semibold">
          Courses terminées
        </h2>
        <p className="border-t border-border pt-4 text-sm leading-normal text-muted">
          Les résultats de course et leur lien vérifié avec tes activités ne
          sont pas encore disponibles. Les objectifs passés et les temps cibles
          ne constituent pas des résultats.
        </p>
      </section>
      <section
        aria-labelledby="records-opportunities"
        className="rounded-panel border border-border bg-surface p-5"
      >
        <h2 id="records-opportunities">
          <MonoLabel size="micro" className="flex items-center gap-2">
            <StrideMark className="size-3" />
            Prochains records à portée
          </MonoLabel>
        </h2>
        {view.opportunities.length ? (
          <ul className="mt-4 flex flex-col">
            {view.opportunities.map(({ race, text }) => (
              <li
                key={race.id}
                className="flex flex-col gap-2 border-t border-border py-4"
              >
                <Link
                  href={`/races/${race.id}`}
                  className="text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {race.name} →
                </Link>
                <MonoLabel size="nano">
                  {formatRecordDate(race.day)} · objectif prévu
                </MonoLabel>
                <p className="text-meta leading-normal text-muted">{text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Aucun objectif à venir dans ton calendrier.
          </p>
        )}
      </section>
    </div>
  );
}
