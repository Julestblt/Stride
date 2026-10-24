import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GearDetail } from "@/features/gear/components/gear-detail";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { modelName } from "@/features/gear/view";
import { requireAthlete } from "@/server/app/session";
import { loadGear } from "@/server/gear/load";

export const metadata: Metadata = { title: "Paire · Matériel" };

export default async function ShoeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireAthlete();
  const { today, shoes } = await loadGear(context);
  const shoe = shoes.find((item) => item.id === id);
  if (!shoe) notFound();
  return (
    <GearFrame
      crumbs={[
        { label: "Matériel", href: "/gear" },
        { label: modelName(shoe.spec) },
      ]}
      back={{ href: "/gear", label: "Retour au matériel" }}
    >
      <GearDetail shoe={shoe} today={today} />
    </GearFrame>
  );
}
