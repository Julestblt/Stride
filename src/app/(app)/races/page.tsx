import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { localToday } from "@/features/app-shell/shell";
import { nextRace } from "@/features/races/race";
import { requireAthlete } from "@/server/app/session";
import { listRaces } from "@/server/races/races";

export default async function RacesPage() {
  const context = await requireAthlete();
  const races = await listRaces(context);
  const race = nextRace(races, localToday(new Date()));
  if (race) redirect(`/races/${race.id}`);
  return (
    <>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
        <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
        <h1 className="text-sm">Courses</h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h2 className="text-title font-semibold">
            Aucune course pour l’instant
          </h2>
          <p className="text-sm text-muted">
            Ajoute ta course objectif pour préparer le parcours, les ravitos, la
            nutrition et l’équipement.
          </p>
          <Button asChild size="md">
            <Link href="/settings/goals">Ajouter une course</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
