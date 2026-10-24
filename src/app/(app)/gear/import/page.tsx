import type { Metadata } from "next";
import { AddTabs } from "@/features/gear/components/add-tabs";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { ImportForm } from "@/features/gear/components/import-form";
import { requireAthlete } from "@/server/app/session";
import { loadImportable } from "@/server/gear/load";

export const metadata: Metadata = {
  title: "Importer depuis Garmin · Matériel",
};

export default async function ImportShoesRoute() {
  const context = await requireAthlete();
  const gear = await loadImportable(context);
  return (
    <GearFrame
      crumbs={[
        { label: "Matériel", href: "/gear" },
        { label: "Importer depuis Garmin" },
      ]}
      back={{ href: "/gear", label: "Retour au matériel" }}
    >
      <section className="flex flex-col gap-2.5">
        <h1 className="text-[clamp(30px,3.2vw,40px)] leading-none font-semibold tracking-[-0.03em]">
          Importer depuis Garmin
        </h1>
        <p className="max-w-160 text-sm text-muted">
          Vérifie les kilomètres de chaque paire : si elle a couru avant d’être
          dans Garmin, saisis son vrai total.
        </p>
      </section>
      <AddTabs current="garmin" />
      <ImportForm
        gear={gear.map((row) => {
          const brand = row.brand ?? row.display_name ?? "Garmin";
          const model = row.model ?? row.display_name ?? "Paire";
          return {
            gearUuid: row.gear_uuid,
            brand,
            model,
            name:
              row.brand && row.model
                ? `${row.brand} ${row.model}`
                : (row.display_name ?? "Paire Garmin"),
            garminKm: row.total_distance_meters / 1000,
            retired: row.status === "retired",
          };
        })}
      />
    </GearFrame>
  );
}
