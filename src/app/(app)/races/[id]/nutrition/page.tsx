import Link from "next/link";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { nutritionReading } from "@/features/races/reading";
import { describeItems, productCarbs } from "@/features/races/nutrition";
import {
  formatDecimal,
  formatDuration,
  formatElapsed,
  formatInteger,
} from "@/features/races/format";
import {
  CardLabel,
  EmptyState,
  RaceCard,
} from "@/features/races/components/race-ui";
import { PrintSheetButton } from "@/features/races/components/print-sheet-button";
import { segmentNight } from "@/features/races/workspace";
import { loadRace } from "@/server/races/load";
import { planFor } from "@/server/races/views";

const scenarioSchema = z
  .enum(["ambitious", "target", "cautious"])
  .catch("target");

export default async function NutritionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { data } = await loadRace(id);
  const views = planFor(data, scenarioSchema.parse(query.scenario));

  if (!views?.planned) {
    return (
      <RaceCard>
        <CardLabel>Nutrition de course</CardLabel>
        <EmptyState
          title="Prépare ton plan de nutrition"
          action={
            <Button asChild variant="outline" size="md">
              <Link href={`/races/${id}${data.course ? "" : "/course"}`}>
                {data.course
                  ? "Définir un objectif de temps"
                  : "Ajouter un parcours GPX"}
              </Link>
            </Button>
          }
        >
          {data.course
            ? "Définis un objectif de temps dans les réglages de la course pour calculer les quantités par tronçon."
            : "Ajoute un parcours GPX et un objectif de temps pour calculer les quantités par tronçon."}
        </EmptyState>
      </RaceCard>
    );
  }

  const { model, planned } = views;
  const tested = data.checklist.filter(
    (item) => item.list === "nutrition_tested",
  );
  const waypointById = new Map(
    model.waypoints.map((waypoint, index) => [
      waypoint.id,
      { waypoint, mark: model.marks[index] },
    ]),
  );
  const labelFor = (id: string) => {
    const item = waypointById.get(id);
    if (!item) return "—";
    if (item.waypoint.kind === "start") return "Départ";
    if (item.waypoint.kind === "finish") return "Arrivée";
    return "label" in item.mark ? item.mark.label : item.waypoint.name;
  };
  const rows = planned.simulation.segments.map((segment, index) => ({
    id: `${segment.fromId}-${segment.toId}`,
    label: `${labelFor(segment.fromId)} → ${labelFor(segment.toId)}`,
    nutrition: planned.nutrition[index],
    night: segmentNight(planned, index),
    note: waypointById.get(segment.toId)?.waypoint.nutritionNote,
  }));
  const metrics = [
    {
      value: `${formatInteger(data.plan.carbsPerHourG)} g/h`,
      label: "Glucides",
      detail: "Rythme cible par heure",
    },
    {
      value: `${formatInteger(planned.nutritionTotals.carbsG)} g`,
      label: "Total course",
      detail: `~${formatInteger(planned.nutritionTotals.gelEquivalents)} gels équivalents`,
    },
    {
      value: `~${formatInteger(planned.nutritionTotals.waterL)} L`,
      label: "Eau",
      detail: `${formatInteger(data.plan.waterMlPerHour)} ml/h`,
    },
    {
      value: `${formatInteger(data.plan.sodiumMgPerHour)} mg/h`,
      label: "Sodium",
      detail: "À ajuster selon la chaleur",
    },
    {
      value: `/${formatInteger(data.plan.alarmMinutes)} min`,
      label: "Alarme montre",
      detail: "Manger, même sans faim",
    },
  ];

  return (
    <>
      <section
        aria-label="Repères nutrition"
        className="grid grid-cols-2 gap-3 sm:gap-0 sm:overflow-hidden sm:rounded-surface sm:border sm:border-border sm:bg-surface lg:grid-cols-5"
      >
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-surface border border-border bg-surface px-4 py-4 sm:rounded-none sm:border-0 sm:px-4.5",
              index < metrics.length - 1 && "sm:border-r sm:border-border",
              metric.label === "Sodium" && "max-sm:hidden",
            )}
          >
            <strong className="font-metric text-[1.65rem] leading-none font-semibold tabular-nums">
              {metric.value}
            </strong>
            <MonoLabel size="micro">{metric.label}</MonoLabel>
            <span className="text-xs text-muted-foreground max-sm:hidden">
              {metric.detail}
            </span>
          </div>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5 lg:contents">
          <RaceCard className="order-2 min-w-0 lg:order-1 lg:row-span-2">
            <div className="flex items-center justify-between gap-3">
              <CardLabel>
                Plan par tronçon{" "}
                <span className="max-sm:hidden">
                  · {formatDuration(planned.scenario.seconds)}
                </span>
              </CardLabel>
              <PrintSheetButton />
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-micro font-normal text-muted-foreground uppercase">
                    <th scope="col" className="py-3 pr-3 font-normal">
                      Tronçon
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-3 text-right font-normal"
                    >
                      Durée
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-3 text-right font-normal"
                    >
                      Glucides
                    </th>
                    <th scope="col" className="px-2 py-3 font-normal">
                      À emporter
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-3 text-right font-normal"
                    >
                      Eau
                    </th>
                    <th scope="col" className="py-3 pl-3 font-normal">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border align-top"
                    >
                      <th
                        scope="row"
                        className="py-3 pr-3 font-medium whitespace-nowrap"
                      >
                        {row.label}
                      </th>
                      <td className="px-2 py-3 text-right font-metric text-lg tabular-nums">
                        {formatElapsed(row.nutrition.movingSeconds)}
                      </td>
                      <td className="px-2 py-3 text-right font-metric text-lg font-semibold whitespace-nowrap text-accent tabular-nums">
                        {formatInteger(row.nutrition.carbsG)} g
                      </td>
                      <td className="px-2 py-3 leading-snug text-muted">
                        {describeItems(row.nutrition.items) || "—"}
                      </td>
                      <td className="px-2 py-3 text-right font-metric text-lg tabular-nums">
                        {formatDecimal(row.nutrition.waterL)} L
                      </td>
                      <td className="py-3 pl-3 leading-snug text-muted">
                        {row.note || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="flex flex-col sm:hidden">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 border-t border-border py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {row.label}
                      {row.night && (
                        <MonoLabel size="nano" tone="accent">
                          Nuit
                        </MonoLabel>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted">
                      {describeItems(row.nutrition.items) || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="font-metric text-xl font-semibold text-accent tabular-nums">
                      {formatInteger(row.nutrition.carbsG)} g
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatElapsed(row.nutrition.movingSeconds)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-sm leading-relaxed text-muted-foreground max-sm:hidden">
              Gel ~{productCarbs.gel} g, compote ~{productCarbs.compote} g,
              barre ~{productCarbs.bar} g. Stride recalcule les quantités si tu
              changes d’objectif ou d’heure de départ.
            </p>
          </RaceCard>
          <RaceCard className="order-1 lg:order-2">
            <CardLabel coach>Lecture de Stride</CardLabel>
            <p className="text-body leading-[1.65] text-muted">
              {nutritionReading(planned, data.plan.carbsPerHourG)}
            </p>
          </RaceCard>
          <RaceCard className="order-3 lg:order-3">
            <CardLabel>Ce que tu as déjà testé</CardLabel>
            {tested.length ? (
              <dl>
                {tested.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-t border-border py-3 text-sm"
                  >
                    <dt>{item.label}</dt>
                    <dd className="text-right text-muted-foreground">
                      {item.detail || (item.checked ? "Testé" : "À tester")}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="border-t border-border pt-3 text-sm text-muted">
                Aucun aliment testé renseigné pour cette course.
              </p>
            )}
          </RaceCard>
        </div>
      </div>
    </>
  );
}
