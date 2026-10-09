"use client";
import { Button } from "@/components/ui/button";
export default function OnboardingError({ reset }: { reset: () => void }) {
  return (
    <main
      lang="fr"
      className="flex min-h-svh flex-col items-center justify-center gap-5 px-5"
    >
      <h1 className="text-headline">
        Ton parcours est temporairement indisponible.
      </h1>
      <p role="alert" className="text-muted">
        Réessaie pour retrouver ta progression.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
