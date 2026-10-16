import type { Metadata } from "next";
import {
  DataActivityStatus,
  DataActivityThread,
} from "@/features/data-activity/components/status";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  LatestSection,
  ReadinessSection,
  SessionSection,
  TodayRaceLine,
  UpcomingSection,
  WeekSection,
} from "@/features/today/components/today-sections";
import { requireAthlete } from "@/server/app/session";
import { loadToday } from "@/server/today/today";

export const metadata: Metadata = { title: "Aujourd’hui" };

export default async function TodayPage() {
  const context = await requireAthlete();
  const { view, checkin } = await loadToday(context, new Date());
  return (
    <>
      <header className="relative flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-5">
        <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
        <Separator
          orientation="vertical"
          className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
        />
        <nav
          aria-label="Fil d’Ariane"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm max-sm:invisible"
        >
          <span aria-current="page">Aujourd’hui</span>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">{view.header.date}</span>
        </nav>
        <DataActivityStatus className="hidden sm:flex md:hidden" />
        <DataActivityThread />
      </header>
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-310 flex-col gap-4.5 px-4 pt-4 pb-18 sm:px-[clamp(20px,3vw,40px)] sm:pt-7">
          <div className="flex min-h-11 items-center gap-2.5 sm:hidden">
            <h1 className="text-[28px] font-semibold tracking-[-0.025em]">
              Aujourd’hui
            </h1>
            <span className="text-[13px] text-muted-foreground">
              {view.header.date}
            </span>
            <DataActivityStatus className="ml-auto" />
          </div>
          <h1 className="sr-only max-sm:hidden">
            Aujourd’hui, {view.header.date}
          </h1>
          <TodayRaceLine header={view.header} />
          <div className="flex flex-col gap-4.5 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] xl:items-start">
            <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4.5">
              <SessionSection session={view.session} date={view.header.date} />
              {view.week && (
                <div className="max-xl:order-3">
                  <WeekSection week={view.week} />
                </div>
              )}
            </div>
            <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4.5">
              <div className="max-xl:order-2">
                <ReadinessSection
                  readiness={view.readiness}
                  legs={checkin?.legs ?? null}
                />
              </div>
              <div className="max-xl:order-5">
                <LatestSection latest={view.latest} />
              </div>
              <div className="max-xl:order-4">
                <UpcomingSection items={view.upcoming} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
