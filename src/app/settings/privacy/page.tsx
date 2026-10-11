import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  SettingsGroup,
  SettingsHeading,
} from "@/features/settings/components/settings-shell";
import { requireAthlete } from "@/server/app/session";
import { readStoredCounts } from "@/server/settings/data";

export default async function PrivacySettingsPage() {
  const context = await requireAthlete();
  const counts = await readStoredCounts(context);
  return (
    <>
      <SettingsHeading
        title="Données et confidentialité"
        description="Consulte les données enregistrées dans ton compte et télécharge une copie de tes réglages."
      />
      <SettingsGroup title="Enregistré dans Stride">
        <div className="border-b border-border p-4 md:px-0">
          <strong className="text-sm">Activités et mesures Garmin</strong>
          <p className="mt-1 text-sm text-muted">
            {counts.activities ?? "—"} activités et {counts.observations ?? "—"}{" "}
            mesures de santé sont enregistrées dans ton compte.
          </p>
        </div>
        <div className="p-4 md:px-0">
          <strong className="text-sm">
            Profil, entraînement, objectifs et courses
          </strong>
          <p className="mt-1 text-sm text-muted">
            Tes réponses restent disponibles dans ton compte après connexion.
          </p>
        </div>
      </SettingsGroup>
      <SettingsGroup title="Ta copie">
        <div className="flex flex-wrap items-center gap-4 p-4 md:px-0">
          <div className="flex-1">
            <strong className="text-sm">Télécharger les réglages</strong>
            <p className="mt-1 text-sm text-muted">
              Profil, objectifs et courses au format JSON. Les activités Garmin
              ne sont pas incluses.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/export">Télécharger le JSON</Link>
          </Button>
        </div>
      </SettingsGroup>
      <section
        aria-labelledby="deletion-heading"
        className="overflow-hidden rounded-surface border border-danger-border bg-danger-surface/40"
      >
        <h2
          id="deletion-heading"
          className="border-b border-danger-border px-4 py-4 font-mono text-label tracking-wider text-danger uppercase md:px-5"
        >
          Suppression
        </h2>
        <div className="flex flex-wrap items-center gap-4 border-b border-danger-border px-4 py-5 md:px-5">
          <div className="flex-1">
            <strong className="text-sm">
              Supprimer les données Garmin importées
            </strong>
            <p className="mt-1 text-sm text-muted">
              Cette action est indisponible tant que l’intégration ne permet pas
              la suppression.
            </p>
          </div>
          <Button type="button" variant="destructive" disabled>
            Indisponible
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 py-5 md:px-5">
          <div className="flex-1">
            <strong className="text-sm">Supprimer le compte</strong>
            <p className="mt-1 text-sm text-muted">
              La suppression du compte est indisponible dans les réglages.
              Contacte l’équipe Stride par le canal d’assistance habituel.
            </p>
          </div>
          <Button type="button" variant="destructive" disabled>
            Indisponible
          </Button>
        </div>
      </section>
    </>
  );
}
