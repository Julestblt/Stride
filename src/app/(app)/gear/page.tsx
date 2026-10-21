import type { Metadata } from "next";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { GearList } from "@/features/gear/components/gear-list";
import {
  PlannedPairs,
  RotationStrip,
} from "@/features/gear/components/gear-week";
import { rotation, weekShoes } from "@/features/gear/planned";
import { pairList } from "@/features/gear/view";
import { requireAthlete } from "@/server/app/session";
import { loadGear, loadImportable } from "@/server/gear/load";
import { loadPlanShoes } from "@/server/gear/planned";
import { loadPlanOverview } from "@/server/plans/overview";

export const metadata: Metadata = { title: "Matériel" };

export default async function GearRoute() {
  const context = await requireAthlete();
  const [{ today, shoes }, importable, overview, planned] = await Promise.all([
    loadGear(context),
    loadImportable(context).catch(() => []),
    loadPlanOverview(context),
    loadPlanShoes(context),
  ]);
  const active = shoes.some((shoe) => shoe.retiredOn === null);
  return (
    <GearFrame crumbs={[{ label: "Matériel" }]}>
      <GearList view={pairList(shoes, today)} importable={importable.length}>
        {active && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-3.5">
            {overview && planned && (
              <PlannedPairs
                rows={weekShoes(planned, overview.plan.state.sessions)}
              />
            )}
            <RotationStrip view={rotation(shoes, today)} />
          </div>
        )}
      </GearList>
    </GearFrame>
  );
}
