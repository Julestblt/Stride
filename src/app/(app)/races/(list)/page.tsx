import { EmptyState } from "@/features/races/components/race-ui";
import {
  CalendarRow,
  FeaturedRace,
  OpenSlot,
  PastRaces,
  SeasonCard,
} from "@/features/races/components/races-overview";
import { RacesTitle } from "@/features/races/components/races-title";
import { localToday } from "@/features/app-shell/shell";
import { parseRacesView, seasonTimeline } from "@/features/races/overview";
import { requireAthlete } from "@/server/app/session";
import { readRacesOverview } from "@/server/races/overview";

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`;
}

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const view = parseRacesView(query.view);
  const today = localToday(new Date());
  const { upcoming, past, featured, calendar, workspace } =
    await readRacesOverview(context, today);
  const counts = { upcoming: upcoming.length, past: past.length };
  const showUpcoming = view !== "past";
  const showPast = view !== "upcoming";
  const timeline = seasonTimeline(upcoming, today, featured);
  const showSlot =
    featured?.priority === "A" &&
    !calendar.some((race) => race.priority === "B");
  const subtitle =
    upcoming.length + past.length === 0
      ? "Ajoute ta course objectif pour préparer le parcours."
      : `${plural(upcoming.length, "course à venir", "courses à venir")} · ${plural(past.length, "passée", "passées")}`;
  return (
    <>
      <RacesTitle view={view} counts={counts} subtitle={subtitle} />
      {upcoming.length + past.length === 0 && (
        <EmptyState title="Aucune course pour l’instant">
          Ajoute ta course objectif pour préparer le parcours, les ravitos, la
          nutrition et l’équipement.
        </EmptyState>
      )}
      {showUpcoming && upcoming.length === 0 && past.length > 0 && (
        <EmptyState title="Aucune course à venir">
          Ajoute ta prochaine course pour préparer le parcours et le calendrier.
        </EmptyState>
      )}
      {showUpcoming && timeline && (
        <SeasonCard timeline={timeline} today={today} />
      )}
      {showUpcoming && featured && workspace && (
        <FeaturedRace
          race={featured}
          today={today}
          plan={workspace.plan}
          course={workspace.course}
          rows={workspace.rows}
          progress={workspace.progress}
          elevation={workspace.elevation}
          nightRanges={workspace.nightRanges}
          nightSeconds={workspace.nightSeconds}
          stationDistances={workspace.stationDistances}
        />
      )}
      {showUpcoming && featured && (calendar.length > 0 || showSlot) && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-xl font-semibold">Aussi au calendrier</h2>
            <span className="text-meta text-muted-foreground">
              Les courses B et C servent l’objectif : tests, répétitions,
              repères.
            </span>
          </div>
          {calendar.map((race) => (
            <CalendarRow key={race.id} race={race} today={today} />
          ))}
          {showSlot && <OpenSlot priority="B" />}
        </section>
      )}
      {showPast && past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Courses passées</h2>
          <PastRaces races={past} />
        </section>
      )}
      {view === "past" && past.length === 0 && upcoming.length > 0 && (
        <EmptyState title="Aucune course passée">
          Les courses dont la date est dépassée apparaîtront ici.
        </EmptyState>
      )}
    </>
  );
}
