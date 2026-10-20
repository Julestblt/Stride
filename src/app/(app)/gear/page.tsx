import type { Metadata } from "next";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { GearList } from "@/features/gear/components/gear-list";
import { pairList } from "@/features/gear/view";
import { requireAthlete } from "@/server/app/session";
import { loadGear, loadImportable } from "@/server/gear/load";

export const metadata: Metadata = { title: "Matériel" };

export default async function GearRoute() {
  const context = await requireAthlete();
  const [{ today, shoes }, importable] = await Promise.all([
    loadGear(context),
    loadImportable(context).catch(() => []),
  ]);
  return (
    <GearFrame crumbs={[{ label: "Matériel" }]}>
      <GearList view={pairList(shoes, today)} importable={importable.length} />
    </GearFrame>
  );
}
