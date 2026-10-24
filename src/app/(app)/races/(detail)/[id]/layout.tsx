import type { Metadata } from "next";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { RaceHeader } from "@/features/races/components/race-header";
import { RaceBreadcrumb, RaceTabs } from "@/features/races/components/race-nav";
import { loadRace } from "@/server/races/load";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { data } = await loadRace((await params).id);
  return { title: `${data.race.name} · Courses` };
}

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
      <AppHeader
        title="Courses"
        back={{ href: "/races", label: "Retour aux courses" }}
        className="print:hidden"
        breadcrumb={
          <RaceBreadcrumb
            raceId={data.race.id}
            name={data.race.name}
            replacing={data.course !== null}
          />
        }
      />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain print:overflow-visible">
        <main className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 pt-3 pb-18 sm:gap-7 sm:px-[clamp(20px,4vw,56px)] md:pt-9 print:max-w-none print:gap-3 print:p-0">
          <RaceHeader
            race={data.race}
            plan={data.plan}
            course={data.course}
            waypoints={data.waypoints}
            today={today}
          />
          <RaceTabs raceId={data.race.id} kind={data.race.kind} />
          {children}
        </main>
      </div>
    </>
  );
}
