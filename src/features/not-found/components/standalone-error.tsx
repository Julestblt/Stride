"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StandalonePage } from "./standalone-page";

export function StandaloneError({ retry }: { retry: () => void }) {
  return (
    <StandalonePage
      alert
      label="Erreur de chargement"
      title="Stride n’a pas pu se charger."
      message="Un service n’a pas répondu à temps. Tes données sont en sécurité : réessaie dans un instant."
    >
      <Button type="button" className="w-full" onClick={retry}>
        Réessayer
      </Button>
      <Button asChild variant="outline" className="w-full">
        <Link href="/">Retour à Stride</Link>
      </Button>
    </StandalonePage>
  );
}
