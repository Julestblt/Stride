import type { Metadata } from "next";
import { localToday } from "@/features/app-shell/shell";
import { AddTabs } from "@/features/gear/components/add-tabs";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { ShoeForm } from "@/features/gear/components/shoe-form";
import { requireAthlete } from "@/server/app/session";

export const metadata: Metadata = { title: "Ajouter une paire · Matériel" };

export default async function NewShoeRoute() {
  await requireAthlete();
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
          Donne le nom de la paire : Stride propose son type, son terrain et une
          phrase pour la décrire. Tu corriges si besoin.
        </p>
      </section>
      <AddTabs current="name" />
      <ShoeForm mode="create" today={localToday(new Date())} />
    </GearFrame>
  );
}
