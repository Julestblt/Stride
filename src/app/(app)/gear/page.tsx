import type { Metadata } from "next";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { GearList } from "@/features/gear/components/gear-list";
import {
  PlannedPairs,
  RotationStrip,
} from "@/features/gear/components/gear-week";
import { pairQuestions } from "@/features/gear/check-view";
import { PairAlert } from "@/features/gear/components/activity-pair";
import { rotation, weekShoes } from "@/features/gear/planned";
import { pairList } from "@/features/gear/view";
import { requireAthlete } from "@/server/app/session";
import { loadPairChecks } from "@/server/gear/checks";
import { loadGear, loadImportable } from "@/server/gear/load";
import { loadPlanShoes } from "@/server/gear/planned";
import { loadPlanOverview } from "@/server/plans/overview";

export const metadata: Metadata = { title: "Matériel" };

export default async function GearRoute() {
  const context = await requireAthlete();
  const [{ today, shoes }, importable, overview, planned, checks] =
    await Promise.all([
      loadGear(context),
      loadImportable(context).catch(() => []),
      loadPlanOverview(context),
      loadPlanShoes(context),
      loadPairChecks(context),
    ]);
  const active = shoes.some((shoe) => shoe.retiredOn === null);
  const questions = checks
    ? pairQuestions(checks.checks.values(), checks.shoes)
    : [];
  const pending = checks
    ? [...checks.checks.values()].flatMap((check) =>
        check.state === "different" && check.garminPairId
          ? [{ pairId: check.garminPairId, day: check.day }]
          : [],
      )
    : [];
  return (
    <GearFrame crumbs={[{ label: "Matériel" }]}>
      <GearList
        view={pairList(shoes, today)}
        importable={importable.length}
        alerts={
          questions.length > 0 && (
            <section
              aria-label="À surveiller"
              className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3"
            >
              {questions.map((question) => (
                <PairAlert key={question.activityId} question={question} />
              ))}
            </section>
          )
        }
      >
        {active && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-3.5">
            {overview && planned && (
              <PlannedPairs
                rows={weekShoes(planned, overview.plan.state.sessions)}
              />
            )}
            <RotationStrip view={rotation(shoes, today, pending)} />
          </div>
        )}
      </GearList>
    </GearFrame>
  );
}
