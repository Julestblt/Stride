import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HistoryBackButton } from "@/features/not-found/components/history-back-button";
import { StandalonePage } from "@/features/not-found/components/standalone-page";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "404 · Page introuvable | Stride",
  description:
    "Cette page n'est pas sur le parcours. Revenez sur le bon chemin avec Stride.",
};

export default async function NotFound() {
  const authenticated = Boolean(await getCurrentUser());
  return (
    <StandalonePage
      label="Erreur 404"
      numeral="404"
      title="Page introuvable"
      message="Le lien est peut-être périmé, ou la page a été déplacée. Reviens sur le tracé, on repart d'ici."
    >
      <Button asChild className="w-full">
        <Link href="/">Retour à Stride</Link>
      </Button>
      <HistoryBackButton />
      {!authenticated && (
        <p className="pt-3 text-center text-sm text-muted-foreground">
          Pas connecté ?{" "}
          <Link
            className="font-medium text-accent hover:underline"
            href="/sign-in"
          >
            Se connecter
          </Link>
        </p>
      )}
    </StandalonePage>
  );
}
