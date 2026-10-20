import type { Metadata } from "next";
import { localToday } from "@/features/app-shell/shell";
import { AddTabs } from "@/features/gear/components/add-tabs";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { ShoeForm } from "@/features/gear/components/shoe-form";
import { requireAthlete } from "@/server/app/session";

export const metadata: Metadata = { title: "Ajouter une paire" };

export default async function NewShoeRoute({
  searchParams,
}: {
  searchParams: Promise<{ via?: string }>;
}) {
  await requireAthlete();
  const manual = (await searchParams).via === "main";
  return (
    <GearFrame
      crumbs={[
        { label: "Matériel", href: "/gear" },
        { label: "Ajouter une paire" },
      ]}
      back={{ href: "/gear", label: "Retour au matériel" }}
    >
      <section className="flex flex-col gap-2.5">
        <h1 className="text-[clamp(30px,3.2vw,40px)] leading-none font-semibold tracking-[-0.03em]">
          Ajouter une paire
        </h1>
        <p className="max-w-155 text-sm text-muted">
          {manual
            ? "Renseigne la paire : Stride la crée dans Garmin Connect, qui comptera ses kilomètres."
            : "Colle le lien de la page produit : Stride lit la page et remplit la fiche. Tu relis avant de valider."}
        </p>
      </section>
      <AddTabs current={manual ? "hand" : "link"} />
      <ShoeForm
        key={manual ? "hand" : "link"}
        mode="create"
        today={localToday(new Date())}
        withLink={!manual}
      />
    </GearFrame>
  );
}
