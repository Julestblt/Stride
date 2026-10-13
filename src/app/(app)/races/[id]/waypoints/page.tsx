import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState, RaceCard } from "@/features/races/components/race-ui";
import { WaypointWorkspace } from "@/features/races/components/waypoint-workspace";
import { profileData } from "@/features/races/profile";
import { loadRace } from "@/server/races/load";
import { planFor } from "@/server/races/views";

export default async function WaypointsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await loadRace(id);
  if (data.race.kind === "road") redirect(`/races/${id}`);
  if (!data.course)
    return (
      <RaceCard>
        <EmptyState title="Ajoute le parcours">
          <span>
            Importe un GPX pour placer tes points de passage sur le tracé.
          </span>
          <Button asChild variant="outline">
            <Link href={`/races/${id}/course`}>Importer un GPX</Link>
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
  return (
    <WaypointWorkspace
      raceId={id}
      waypoints={model.waypoints}
      marks={model.marks}
      profile={profile}
      passages={planned?.simulation.passages ?? []}
      distanceM={model.course.distanceM}
    />
  );
}
