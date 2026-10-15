import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import {
  formatClock,
  formatDecimal,
  formatDuration,
  formatElapsed,
  formatKm,
  formatMargin,
  formatPace,
} from "../format";
import type { ProfileData } from "../profile";
import { formatShortDate, type RaceSummary } from "../race";
import type { Reading, StrategyItem } from "../reading";
import { glyphFor, type RaceWeather } from "../weather";
import type { CourseModel, RacePlanModel, Scenario } from "../workspace";
import { segmentNight } from "../workspace";
import { ProfileChart } from "./profile-chart";
import { CardLabel, Figure, LegendItem, RaceCard, StatusPill } from "./race-ui";
import { WeatherIcon } from "./weather-icon";

export function ReadingCard({
  reading,
  road = false,
  strategy = false,
}: {
  reading: Reading;
  road?: boolean;
  strategy?: boolean;
}) {
  return (
    <div className="relative">
      <details className="group rounded-panel border border-border bg-surface">
        <summary
          className={cn(
            "flex cursor-pointer list-none flex-col gap-2 rounded-panel px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-14 sm:flex-row sm:items-center sm:gap-3.5 sm:px-5 [&::-webkit-details-marker]:hidden",
            strategy && "sm:pr-31",
          )}
        >
          <MonoLabel className="flex shrink-0 items-center gap-2 whitespace-nowrap max-sm:text-nano">
            <StrideMark className="size-3.5 shrink-0" />
            {road ? "Repères de course" : "Lecture de Stride"}
          </MonoLabel>
          <span
            aria-hidden="true"
            className="h-4.5 w-px shrink-0 bg-border-strong max-sm:hidden"
          />
          <span className="min-w-0 text-base leading-[1.35] font-semibold tracking-[-0.01em] sm:flex-1 sm:truncate">
            {reading.title}
          </span>
          <span className="flex min-h-7 items-center gap-1.5 text-meta whitespace-nowrap text-muted sm:min-h-0 sm:border-l sm:border-border sm:pl-3.5">
            <span className="group-open:hidden">Lire l’analyse</span>
            <span className="hidden group-open:inline">Réduire</span>
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3 shrink-0 group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-150"
            />
          </span>
        </summary>
        <div className="px-4 pb-4 sm:mx-5 sm:border-t sm:border-border sm:px-0 sm:pt-3.5 sm:pb-5.5 sm:pl-5.5">
          <p className="max-w-205 border-t border-border pt-3.5 text-sm leading-[1.65] text-muted sm:border-t-0 sm:pt-0 sm:text-body sm:leading-[1.65]">
            {reading.body}
          </p>
        </div>
      </details>
      {strategy && (
        <a
          href="#strategie"
          className="absolute top-3 right-4 rounded-tag text-meta whitespace-nowrap text-accent hover:underline focus-visible:outline-2 focus-visible:outline-ring sm:top-4.5 sm:right-5"
        >
          Stratégie ↓
        </a>
      )}
    </div>
  );
}

export function ProfileCard({
  profile,
  planned,
  weather,
  walkThreshold,
  walkCount,
  walkDistanceM,
  race,
}: {
  profile: ProfileData;
  planned: RacePlanModel | null;
  weather: RaceWeather | null;
  walkThreshold: number;
  walkCount: number;
  walkDistanceM: number;
  race: RaceSummary;
}) {
  const road = race.kind === "road";
  const label = road
    ? `Profil altimétrique du parcours : ${formatKm(profile.distanceM)} km`
    : `Profil altimétrique : ${formatKm(profile.distanceM)} km, ${walkCount} portions de marche au-dessus de ${walkThreshold} %`;
  const weatherNote = weather
    ? weather.mode === "forecast"
      ? "Prévisions Open-Meteo · mises à jour chaque matin"
      : `Météo : normales de saison du ${race.date ? formatShortDate(race.date) : "jour J"} · prévisions dès le ${formatShortDate(weather.forecastFrom)}`
    : null;
  return (
    <RaceCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardLabel>
          <span className="max-sm:hidden">
            {road ? "Profil du parcours" : "Profil, passages et météo"}
            {planned
              ? ` · simulation ${formatDuration(planned.scenario.seconds)}`
              : ""}
          </span>
          <span className="sm:hidden">
            {road ? "Profil du parcours" : "Profil, passages et météo"}
          </span>
        </CardLabel>
        {!road && weatherNote && (
          <MonoLabel size="micro" className="text-dim max-sm:hidden">
            {weatherNote}
          </MonoLabel>
        )}
        {!road && weather && (
          <MonoLabel size="micro" className="text-dim sm:hidden">
            {weather.mode === "forecast" ? "Prévisions" : "Normales"}
          </MonoLabel>
        )}
      </div>
      <ProfileChart
        data={profile}
        variant="full"
        label={label}
        className="max-sm:hidden"
      />
      <ProfileChart
        data={profile}
        variant="mobile"
        label={label}
        className="sm:hidden"
      />
      {!road && (
        <div className="flex flex-wrap gap-x-5.5 gap-y-2">
          {!road && (
            <LegendItem
              mark={<span className="h-0.75 w-4.5 rounded-mark bg-accent" />}
            >
              <span className="max-sm:hidden">
                Marche rapide ≥ {walkThreshold} % · {walkCount} portions ·{" "}
                {formatDecimal(walkDistanceM / 1000)} km
              </span>
              <span className="sm:hidden">Marche ≥ {walkThreshold} %</span>
            </LegendItem>
          )}
          {!road && profile.night.length > 0 && (
            <LegendItem
              mark={<span className="h-2.5 w-3.5 rounded-mark bg-night/35" />}
            >
              <span className="max-sm:hidden">De nuit</span>
              <span className="sm:hidden">Nuit</span>
            </LegendItem>
          )}
          {!road && profile.rain.length > 0 && (
            <LegendItem
              mark={
                <span className="h-2.5 w-3.5 rounded-mark bg-[repeating-linear-gradient(45deg,var(--provider)_0_1px,transparent_1px_4px)]" />
              }
            >
              Averses prévues
            </LegendItem>
          )}
          {!road && planned && (
            <span className="max-sm:hidden">
              <LegendItem
                mark={
                  <span className="font-metric text-sm font-semibold text-accent">
                    {formatClock(planned.simulation.passages[0].clockMinutes)}
                  </span>
                }
              >
                Passage prévu
              </LegendItem>
            </span>
          )}
          {!road && profile.markers.some((marker) => marker.cutoff) && (
            <span className="max-sm:hidden">
              <LegendItem
                mark={
                  <MonoLabel size="nano" tone="warning">
                    BH
                  </MonoLabel>
                }
              >
                Barrière horaire
              </LegendItem>
            </span>
          )}
        </div>
      )}
      {!road && planned && (
        <ul className="flex flex-col sm:hidden">
          {profile.markers
            .filter((marker) => marker.boundary)
            .map((marker) => (
              <li
                key={marker.id}
                className="flex items-center gap-3 border-t border-border py-2.5"
              >
                <MarkBadge marker={marker} />
                <span className="flex-1 text-sm">
                  {marker.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatKm(marker.distanceM)}
                  </span>
                </span>
                <span className="font-metric text-lg font-semibold text-accent">
                  {marker.clock}
                </span>
                <MonoLabel
                  size="nano"
                  tone="warning"
                  className="w-16 text-right"
                >
                  {marker.cutoff ? `BH ${marker.cutoff}` : ""}
                </MonoLabel>
              </li>
            ))}
        </ul>
      )}
    </RaceCard>
  );
}

export function MarkBadge({
  marker,
  active = false,
}: {
  marker: Pick<ProfileData["markers"][number], "mark">;
  active?: boolean;
}) {
  const { mark } = marker;
  if (mark.shape === "diamond" || mark.shape === "triangle")
    return (
      <span
        aria-hidden="true"
        className="grid size-5.5 shrink-0 place-items-center"
      >
        <span
          className={cn(
            "size-3.5 rotate-45 border-[1.6px]",
            mark.shape === "triangle"
              ? "border-muted"
              : mark.tone === "caution"
                ? "border-warning"
                : "border-night",
          )}
        />
      </span>
    );
  const filled = active || (mark.shape === "circle" && mark.tone !== "station");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5.5 shrink-0 place-items-center font-metric text-xs leading-none font-bold",
        mark.shape === "square" ? "rounded-tag" : "rounded-full",
        active || (mark.shape === "circle" && mark.tone === "finish")
          ? "bg-accent text-accent-foreground"
          : mark.shape === "circle" && mark.tone === "start"
            ? "bg-foreground text-background"
            : mark.shape === "square"
              ? "border-[1.6px] border-provider text-foreground"
              : "border-[1.6px] border-foreground text-foreground",
        filled && "border-0",
      )}
    >
      {mark.label}
    </span>
  );
}

export function WeatherCard({
  weather,
  planned,
  race,
}: {
  weather: RaceWeather;
  planned: RacePlanModel;
  race: RaceSummary;
}) {
  const start = planned.simulation.passages[0].clockMinutes;
  const finish = start + planned.simulation.finishSeconds / 60;
  const headlineGlyph = glyphFor(
    [...weather.slots].sort(
      (a, b) => b.precipitationProbability - a.precipitationProbability,
    )[0].code,
    false,
  );
  const road = race.kind === "road";
  const temperature = weather.slots.map((slot) => slot.temperature);
  const precipitation = weather.slots.map(
    (slot) => slot.precipitationProbability,
  );
  const showSlots =
    !road ||
    (weather.mode === "forecast" &&
      planned.simulation.finishSeconds >= 2 * 3600 &&
      (Math.max(...temperature) - Math.min(...temperature) >= 2 ||
        Math.max(...precipitation) - Math.min(...precipitation) >= 20));
  const minTemperature = Math.round(Math.min(...temperature));
  const maxTemperature = Math.round(Math.max(...temperature));
  const weatherDetail =
    road && minTemperature === maxTemperature
      ? weather.detail.replace(
          `${minTemperature} → ${maxTemperature} °C`,
          `${minTemperature} °C`,
        )
      : weather.detail;
  return (
    <RaceCard>
      <div className="flex items-center justify-between gap-3">
        <CardLabel>Météo du jour J</CardLabel>
        <div className="flex gap-1.5">
          <StatusPill>Départ {formatClock(start)}</StatusPill>
          <StatusPill tone="outline">Arrivée ~{formatClock(finish)}</StatusPill>
        </div>
      </div>
      <div className="flex items-center gap-3.5 rounded-[10px] bg-surface-raised px-4 py-3.5">
        <WeatherIcon
          glyph={weather.mode === "forecast" ? headlineGlyph : "partly"}
          tone={false}
          className={cn(
            "size-7.5",
            weather.mode === "forecast" && headlineGlyph === "rain"
              ? "text-provider"
              : "text-foreground",
          )}
        />
        <div className="flex flex-1 flex-col gap-0.5">
          <MonoLabel size="nano">
            {weather.mode === "forecast"
              ? "Pendant la course"
              : `Normales du ${race.date ? formatShortDate(race.date) : "jour J"}`}
          </MonoLabel>
          <span className="text-lead font-semibold">{weather.title}</span>
          <span className="text-meta text-muted">{weatherDetail}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-right text-xs text-muted">
          {weather.mode === "forecast" ? (
            weather.facts.map((fact) => <span key={fact}>{fact}</span>)
          ) : (
            <>
              <span>Prévisions</span>
              <span>dès le {formatShortDate(weather.forecastFrom)}</span>
            </>
          )}
        </div>
      </div>
      {showSlots && (
        <div className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto">
          {weather.slots.map((slot) => {
            const glyph = glyphFor(slot.code, slot.night);
            const wet =
              weather.mode === "forecast" &&
              slot.precipitationProbability >= 50;
            return (
              <div
                key={slot.elapsedSeconds}
                className={cn(
                  "flex flex-[1_0_58px] flex-col items-center gap-0.75 rounded-surface border px-1 py-2",
                  wet
                    ? "border-provider/40 bg-provider/15"
                    : "border-border-subtle bg-surface-inset",
                )}
              >
                <MonoLabel size="nano">
                  {String(
                    Math.floor(
                      (((slot.clockMinutes % 1440) + 1440) % 1440) / 60,
                    ),
                  ).padStart(2, "0")}
                  h
                </MonoLabel>
                <WeatherIcon glyph={glyph} />
                <span className="font-metric text-lg leading-none font-semibold">
                  {Math.round(slot.temperature)}°
                </span>
                <span
                  className={cn(
                    "text-micro",
                    wet ? "text-provider" : "text-dim",
                  )}
                >
                  {Math.round(slot.precipitationProbability)} %
                </span>
                <MonoLabel size="nano" className="tracking-normal">
                  km {Math.round(slot.distanceM / 1000)}
                </MonoLabel>
              </div>
            );
          })}
        </div>
      )}
      <MonoLabel size="nano" className="self-end text-dim">
        {weather.source}
      </MonoLabel>
    </RaceCard>
  );
}

export function NightCard({
  planned,
  model,
  raceId,
}: {
  planned: RacePlanModel;
  model: CourseModel;
  raceId: string;
}) {
  const night = planned.night!;
  const start = planned.simulation.passages[0].clockMinutes;
  const clockOf = (seconds: number) => formatClock(start + seconds / 60);
  const sunrise =
    night.sunrise === null || planned.startEpochMs === null
      ? null
      : formatClock(start + (night.sunrise - planned.startEpochMs) / 60_000);
  const sunset =
    night.sunset === null || planned.startEpochMs === null
      ? null
      : formatClock(start + (night.sunset - planned.startEpochMs) / 60_000);
  const hours = Math.ceil(night.totalSeconds / 1800) / 2;
  return (
    <RaceCard>
      <div className="flex items-center justify-between">
        <CardLabel>Nuit</CardLabel>
        <WeatherIcon glyph="moon" className="size-4.5" />
      </div>
      <div className="flex gap-6">
        {sunrise && <Figure value={sunrise} label="lever du soleil" />}
        {sunset && <Figure value={sunset} label="coucher" />}
        <Figure
          value={formatDuration(night.totalSeconds)}
          label="de nuit"
          tone="night"
        />
      </div>
      <div className="flex flex-col gap-2 text-sm text-muted">
        {night.windows.map((window, index) => {
          const range = planned.nightKm[index];
          const startsAtGun = window.fromSeconds === 0;
          const endsAtFinish =
            window.toSeconds >= planned.simulation.finishSeconds - 60;
          return (
            <span key={window.fromSeconds} className="flex gap-2.5">
              <span className="w-24 shrink-0 font-metric text-base text-foreground">
                {clockOf(window.fromSeconds)} → {clockOf(window.toSeconds)}
              </span>
              <span>
                km {formatKm(range.fromM).replace(",0", "")} →{" "}
                {endsAtFinish ? "arrivée" : formatKm(range.toM)}
                {startsAtGun
                  ? ", départ à la frontale"
                  : endsAtFinish
                    ? `, les ${Math.round((model.course.distanceM - range.fromM) / 1000)} derniers km`
                    : ""}
              </span>
            </span>
          );
        })}
      </div>
      <p className="text-meta text-muted-foreground">
        Frontale : au moins {formatDuration(hours * 3600)} d’autonomie, ou une
        batterie de rechange dans le sac. Ces horaires se recalculent si tu
        changes l’heure de départ ou l’objectif.
      </p>
      <Link
        href={`/races/${raceId}/gear`}
        className="text-meta text-accent hover:text-foreground"
      >
        Voir l’équipement de nuit →
      </Link>
    </RaceCard>
  );
}

export function ScenarioChips({
  scenarios,
  current,
  raceId,
  start,
}: {
  scenarios: Scenario[];
  current: Scenario;
  raceId: string;
  start: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {scenarios.map((scenario) => (
        <Link
          key={scenario.key}
          href={
            scenario.key === "target"
              ? `/races/${raceId}`
              : `/races/${raceId}?scenario=${scenario.key}`
          }
          scroll={false}
          aria-current={scenario.key === current.key ? "true" : undefined}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.75 rounded-full border border-border-strong px-3 text-meta whitespace-nowrap text-muted transition-colors hover:text-foreground max-sm:flex-1 max-sm:justify-center",
            scenario.key === current.key &&
              "border-dim bg-surface-raised text-foreground",
          )}
        >
          {formatDuration(scenario.seconds)}
          <span className="text-label text-muted-foreground max-sm:hidden">
            {scenario.label}
          </span>
        </Link>
      ))}
      <span className="ml-1.5 text-meta text-muted-foreground max-sm:hidden">
        départ {formatClock(start)}
      </span>
    </div>
  );
}

export function SimulationCard({
  model,
  planned,
  scenarios,
  raceId,
  walkThreshold,
  walkPace,
  aidStop,
  waterStop,
}: {
  model: CourseModel;
  planned: RacePlanModel;
  scenarios: Scenario[];
  raceId: string;
  walkThreshold: number;
  walkPace: number;
  aidStop: number;
  waterStop: number;
}) {
  const names = new Map(
    model.waypoints.map((waypoint, index) => [waypoint.id, model.marks[index]]),
  );
  const short = (id: string) => {
    const mark = names.get(id);
    const waypoint = model.waypoints.find((item) => item.id === id);
    if (waypoint?.kind === "start") return "Départ";
    if (waypoint?.kind === "finish") return "Arrivée";
    return mark && "label" in mark ? mark.label : (waypoint?.name ?? "");
  };
  const start = planned.simulation.passages[0].clockMinutes;
  const rows = planned.simulation.segments.map((segment, index) => ({
    segment,
    night: segmentNight(planned, index),
    title: `${short(segment.fromId)} → ${short(segment.toId)}`,
    cutoff:
      segment.arrival.cutoffSeconds !== null
        ? formatClock(start + segment.arrival.cutoffSeconds / 60)
        : null,
  }));
  const hasCutoffs = rows.some((row) => row.cutoff);
  return (
    <RaceCard className="lg:flex-[1.7]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardLabel>Simulation par tronçon</CardLabel>
        <ScenarioChips
          scenarios={scenarios}
          current={planned.scenario}
          raceId={raceId}
          start={start}
        />
      </div>
      {!planned.simulation.feasible && (
        <p role="status" className="text-sm text-warning">
          Cet objectif est hors de portée avec la marche et les arrêts prévus :
          la simulation est à revoir.
        </p>
      )}
      <div className="overflow-x-auto max-sm:hidden">
        <table className="w-full border-collapse font-metric text-lg font-medium tabular-nums">
          <thead>
            <tr className="border-b border-border-strong">
              {[
                "Tronçon",
                "Km",
                "D+",
                "Marche km",
                "Temps",
                "Allure",
                "Passage",
                ...(hasCutoffs ? ["Barrière", "Marge"] : []),
              ].map((heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={cn(
                    "px-2.5 py-2.5 font-mono text-micro font-normal tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase",
                    index === 0 ? "pl-0 text-left" : "text-right",
                  )}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ segment, night, title, cutoff }) => (
              <tr key={segment.toId} className="border-b border-border">
                <th
                  scope="row"
                  className="py-3 pr-2.5 text-left font-sans text-sm font-medium whitespace-nowrap"
                >
                  {title}
                  {night && (
                    <MonoLabel size="nano" className="ml-1.5 text-night">
                      nuit
                    </MonoLabel>
                  )}
                </th>
                <td className="px-2.5 py-3 text-right">
                  {formatKm(segment.toM - segment.fromM)}
                </td>
                <td className="px-2.5 py-3 text-right">
                  {segment.gainM !== null ? `+${segment.gainM}` : "—"}
                </td>
                <td className="px-2.5 py-3 text-right text-accent">
                  {segment.walkM >= 50
                    ? formatDecimal(segment.walkM / 1000)
                    : "—"}
                </td>
                <td className="px-2.5 py-3 text-right">
                  {formatElapsed(segment.movingSeconds)}
                </td>
                <td className="px-2.5 py-3 text-right">
                  {formatPace(segment.paceSecondsPerKm)}
                </td>
                <td className="px-2.5 py-3 text-right text-accent">
                  {formatClock(segment.arrival.clockMinutes)}
                </td>
                {hasCutoffs && (
                  <>
                    <td
                      className={cn(
                        "px-2.5 py-3 text-right",
                        cutoff ? "text-warning" : "text-dim",
                      )}
                    >
                      {cutoff ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "py-3 pl-2.5 text-right",
                        segment.arrival.marginSeconds !== null &&
                          segment.arrival.marginSeconds < 0
                          ? "text-danger"
                          : "text-success",
                      )}
                    >
                      {segment.arrival.marginSeconds !== null
                        ? formatMargin(segment.arrival.marginSeconds)
                        : ""}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col sm:hidden">
        {rows.map(({ segment, title, cutoff }) => (
          <li
            key={segment.toId}
            className="flex justify-between gap-3 border-t border-border py-2.5"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium">
                {title}
                <span className="font-normal text-muted">
                  {" "}
                  · {formatKm(segment.toM - segment.fromM)} km
                  {segment.gainM !== null ? ` · +${segment.gainM}` : ""}
                </span>
              </span>
              <span className="text-meta text-muted-foreground">
                {formatElapsed(segment.movingSeconds)} ·{" "}
                {formatPace(segment.paceSecondsPerKm)} /km
                {segment.walkM >= 50
                  ? ` · marche ${formatDecimal(segment.walkM / 1000)} km`
                  : ""}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="font-metric text-lg font-semibold text-accent">
                {formatClock(segment.arrival.clockMinutes)}
              </span>
              {cutoff && (
                <span
                  className={cn(
                    "text-xs",
                    (segment.arrival.marginSeconds ?? 0) < 0
                      ? "text-danger"
                      : "text-success",
                  )}
                >
                  BH {cutoff} ·{" "}
                  {formatMargin(segment.arrival.marginSeconds ?? 0)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-meta text-muted-foreground">
        Inclut {formatDuration(aidStop)} par ravito et{" "}
        {formatDuration(waterStop)} au point d’eau. Marche comptée à{" "}
        {formatPace(walkPace)} /km au-dessus de {walkThreshold} %
        {planned.simulation.fade > 0
          ? `, ralentissement progressif de ${Math.round(planned.simulation.fade * 100)} % jusqu’à l’arrivée`
          : ""}
        .
        {hasCutoffs
          ? " Barrières indicatives : à confirmer avec le règlement."
          : ""}
      </p>
    </RaceCard>
  );
}

export function StrategyCard({ items }: { items: StrategyItem[] }) {
  return (
    <RaceCard id="strategie" className="scroll-mt-6 lg:flex-1">
      <CardLabel coach>Stratégie de course</CardLabel>
      <ol>
        {items.map((item, index) => (
          <li
            key={item.title}
            className="grid grid-cols-[28px_1fr] gap-2.5 border-t border-border py-3"
          >
            <span className="font-metric text-xl font-semibold text-accent">
              {index + 1}
            </span>
            <span className="flex flex-col gap-0.75">
              <span className="text-body font-semibold">{item.title}</span>
              <span className="text-sm leading-normal text-muted">
                {item.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </RaceCard>
  );
}

export function OtherRaces({
  races,
  currentId,
}: {
  races: RaceSummary[];
  currentId: string;
}) {
  const others = races.filter((race) => race.id !== currentId);
  return (
    <section className="flex flex-col sm:hidden">
      <MonoLabel size="micro" className="pb-2">
        Autres objectifs
      </MonoLabel>
      {others.map((race) => (
        <Link
          key={race.id}
          href={`/races/${race.id}`}
          className="flex items-center justify-between border-t border-border py-3.5"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-body">{race.name}</span>
            <span className="text-meta text-muted-foreground">
              Course {race.priority}
              {race.date ? ` · ${formatShortDate(race.date)}` : ""}
            </span>
          </span>
          {race.targetSeconds && (
            <span className="flex flex-col items-end">
              <span className="font-metric text-xl font-semibold">
                {formatDuration(race.targetSeconds)}
              </span>
              <MonoLabel size="nano">Objectif</MonoLabel>
            </span>
          )}
        </Link>
      ))}
      <Link
        href="/settings/goals"
        className="mt-1 flex min-h-12 items-center justify-center rounded-card border border-dashed border-border-strong text-sm text-muted hover:text-foreground"
      >
        + Ajouter une course
      </Link>
    </section>
  );
}
