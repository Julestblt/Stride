import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MonoLabel } from "@/components/stride/mono-label";
import { RaceHeader } from "@/features/races/components/race-header";
import { RaceBreadcrumb, RaceTabs } from "@/features/races/components/race-nav";
import { loadRace } from "@/server/races/load";

export default async function RaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, today } = await loadRace(id);
  return (
    <>
      <header className="relative flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-5 print:hidden">
        <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
        <Separator
          orientation="vertical"
          className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
        />
        <div className="hidden min-w-0 flex-1 sm:flex">
          <RaceBreadcrumb
            raceId={data.race.id}
            name={data.race.name}
            replacing={data.course !== null}
          />
        </div>
        <MonoLabel className="sm:hidden">Courses</MonoLabel>
        <DataActivityStatus className="ml-auto md:hidden" />
        <DataActivityThread />
      </header>
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain print:overflow-visible">
        <main className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 pt-6 pb-18 sm:gap-7 sm:px-[clamp(20px,4vw,56px)] sm:pt-9 print:max-w-none print:gap-3 print:p-0">
          <RaceHeader
            race={data.race}
            plan={data.plan}
            course={data.course}
            waypointCount={data.waypoints.length}
            today={today}
          />
          <RaceTabs raceId={data.race.id} kind={data.race.kind} />
          {children}
        </main>
      </div>
    </>
  );
}
