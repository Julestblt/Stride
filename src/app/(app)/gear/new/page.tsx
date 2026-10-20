import type { Metadata } from "next";
import Link from "next/link";
import { localToday } from "@/features/app-shell/shell";
import { GearFrame } from "@/features/gear/components/gear-frame";
import { ShoeForm } from "@/features/gear/components/shoe-form";
import { requireAthlete } from "@/server/app/session";

export const metadata: Metadata = { title: "Ajouter une paire" };

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
          Renseigne la paire : Stride la crée dans Garmin Connect, qui comptera
          ses kilomètres.
        </p>
      </section>
      <nav
        aria-label="Façon d’ajouter"
        className="flex max-w-130 gap-1 rounded-card border border-border bg-surface p-1"
      >
        <span
          aria-current="page"
          className="flex min-h-10 flex-1 items-center justify-center rounded-control bg-border text-sm font-semibold"
        >
          À la main
        </span>
        <Link
          href="/gear/import"
          className="flex min-h-10 flex-1 items-center justify-center rounded-control text-sm text-muted-foreground hover:text-foreground"
        >
          Depuis Garmin
        </Link>
      </nav>
      <ShoeForm mode="create" today={localToday(new Date())} />
    </GearFrame>
  );
}
