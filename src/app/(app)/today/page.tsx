import type { Metadata } from "next";
import { AppHeader } from "@/features/app-shell/components/app-header";
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
      <AppHeader title="Aujourd’hui" detail={view.header.date} />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-310 flex-col gap-4.5 px-4 pt-3 pb-18 sm:px-[clamp(20px,3vw,40px)] md:pt-7">
          <h1 className="sr-only">Aujourd’hui, {view.header.date}</h1>
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
