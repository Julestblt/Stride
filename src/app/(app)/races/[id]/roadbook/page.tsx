import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { ProfileChart } from "@/features/races/components/profile-chart";
import { PrintSheetButton } from "@/features/races/components/print-sheet-button";
import {
  CardLabel,
  EmptyState,
  RaceCard,
} from "@/features/races/components/race-ui";
import {
  formatClock,
  formatElapsed,
  formatInteger,
  formatKm,
  formatMargin,
} from "@/features/races/format";
import { profileData } from "@/features/races/profile";
import { defaultStartMinutes } from "@/features/races/race";
import { defaultWatchLabel, serviceLabels } from "@/features/races/waypoints";
import { loadRace } from "@/server/races/load";
import { planFor } from "@/server/races/views";

export default async function RoadbookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await loadRace(id);
  const base = `/races/${id}`;
  if (!data.course)
    return (
      <RaceCard>
        <EmptyState title="Ajoute le parcours">
          <span>
            Importe un GPX pour préparer ton roadbook et placer les points de
            passage.
          </span>
          <Button asChild variant="outline">
            <Link href={`${base}/course`}>Importer un GPX</Link>
          </Button>
        </EmptyState>
      </RaceCard>
    );

  const views = planFor(data);
  if (!views) return null;
  const { model, planned } = views;
  const profile = profileData({
    course: model.course,
    waypoints: model.waypoints,
    marks: model.marks,
    portions: model.portions,
    planned,
    weather: null,
  });
  const passages = new Map(
    planned?.simulation.passages.map((passage) => [
      passage.waypointId,
      passage,
    ]),
  );
  const segments = new Map(
    planned?.simulation.segments.map((segment) => [segment.toId, segment]),
  );
  const stations = model.waypoints.filter(
    (point) => point.kind !== "caution" && point.kind !== "instruction",
  ).length;
  const instructions = model.waypoints.length - stations;

  return (
    <>
      <RaceCard className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel>
            Profil · {formatKm(model.course.distanceM)} km ·{" "}
            {formatInteger(model.course.elevationGainM ?? 0)} m D+
          </CardLabel>
          <Link href={base} className="text-sm text-accent hover:underline">
            Voir la carte →
          </Link>
        </div>
        <ProfileChart
          data={profile}
          variant="compact"
          label="Profil altimétrique du parcours"
        />
      </RaceCard>
      <RaceCard className="gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardLabel>
              Roadbook · {stations} points
              {instructions ? ` + ${instructions} consignes` : ""}
            </CardLabel>
            <p className="text-sm text-muted">
              {planned
                ? `Passages calculés pour ${formatElapsed(planned.scenario.seconds)} avec départ à ${formatClock(data.plan.startMinutes ?? defaultStartMinutes)}.`
                : "Définis un objectif de temps pour calculer tes heures de passage."}{" "}
              Les alertes sont envoyées à la montre avant chaque point selon
              leur réglage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintSheetButton />
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/waypoints`}>Modifier les points</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/waypoints#import-roadbook`}>
                Roadbook PDF
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/races/${id}/export?format=fit`}>
                Course .fit pour la montre
              </a>
            </Button>
          </div>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-235 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] tracking-wider text-muted uppercase">
                <th className="py-3">Point</th>
                <th>Km</th>
                <th>Depuis le précédent</th>
                <th>Passage</th>
                <th>Barrière / marge</th>
                <th>Services</th>
                <th>À faire</th>
                <th>Alerte montre</th>
              </tr>
            </thead>
            <tbody>
              {model.waypoints.map((point, index) => {
                const passage = passages.get(point.id);
                const segment = segments.get(point.id);
                const mark = model.marks[index];
                return (
                  <tr
                    key={point.id}
                    className="border-b border-border-subtle align-top"
                  >
                    <td className="min-w-38 py-3 font-medium">
                      {mark.shape === "circle" || mark.shape === "square" ? (
                        <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full border border-border-strong font-metric text-sm">
                          {mark.label}
                        </span>
                      ) : null}
                      {point.name}
                      {point.needsReview && (
                        <span className="ml-2 text-warning">À vérifier</span>
                      )}
                    </td>
                    <td className="font-metric text-lg">
                      {formatKm(point.distanceM)}
                    </td>
                    <td className="min-w-37 text-muted">
                      {segment
                        ? `${formatKm(segment.toM - segment.fromM)} km · +${formatInteger(segment.gainM ?? 0)}/−${formatInteger(segment.lossM ?? 0)} · ${formatElapsed(segment.movingSeconds)}`
                        : "—"}
                    </td>
                    <td className="font-metric text-lg text-accent">
                      {passage ? formatClock(passage.clockMinutes) : "—"}
                    </td>
                    <td>
                      {point.cutoffMinutes !== null ? (
                        <>
                          <span className="text-warning">
                            {formatClock(point.cutoffMinutes)}
                          </span>
                          {passage?.marginSeconds !== null &&
                            passage?.marginSeconds !== undefined && (
                              <span className="block text-success">
                                {formatMargin(passage.marginSeconds)}
                              </span>
                            )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="min-w-25 text-xs text-muted">
                      {point.services
                        .map((service) => serviceLabels[service])
                        .join(" · ") || "—"}
                    </td>
                    <td className="min-w-45 text-xs text-muted">
                      {point.todo || "—"}
                    </td>
                    <td className="min-w-30 font-mono text-[10px] text-muted uppercase">
                      {point.watchLabel || defaultWatchLabel(point, mark)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ol className="space-y-3 lg:hidden">
          {model.waypoints.map((point, index) => {
            const passage = passages.get(point.id);
            const segment = segments.get(point.id);
            const mark = model.marks[index];
            return (
              <li
                key={point.id}
                className="rounded-card border border-border-strong bg-surface-raised p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">
                    {mark.shape === "circle" || mark.shape === "square"
                      ? `${mark.label} · `
                      : ""}
                    {point.name}
                  </h3>
                  <span className="font-metric text-xl text-accent">
                    {passage ? formatClock(passage.clockMinutes) : "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  km {formatKm(point.distanceM)}
                  {segment
                    ? ` · ${formatKm(segment.toM - segment.fromM)} km depuis le précédent · +${formatInteger(segment.gainM ?? 0)} m · ${formatElapsed(segment.movingSeconds)}`
                    : ""}
                </p>
                {point.cutoffMinutes !== null && (
                  <p className="mt-2 text-xs text-warning">
                    BH {formatClock(point.cutoffMinutes)}
                    {passage?.marginSeconds != null
                      ? ` · ${formatMargin(passage.marginSeconds)}`
                      : ""}
                  </p>
                )}
                {point.services.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    {point.services
                      .map((service) => serviceLabels[service])
                      .join(" · ")}
                  </p>
                )}
                {point.todo && <p className="mt-3 text-sm">{point.todo}</p>}
                <MonoLabel size="micro" className="mt-3">
                  Montre · {point.watchLabel || defaultWatchLabel(point, mark)}
                </MonoLabel>
              </li>
            );
          })}
        </ol>
      </RaceCard>
    </>
  );
}
