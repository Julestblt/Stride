import { ProvenanceLabel } from "@/components/stride/provenance";
import { StrideMark } from "@/components/stride/stride-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { cn } from "@/lib/utils";

const sectionTitle =
  "px-1.5 font-mono text-micro tracking-wider text-muted uppercase md:px-0 md:text-label";

const columnTitle =
  "font-mono text-micro tracking-wider text-muted-foreground uppercase";

function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-1 md:px-0">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:tracking-[-0.025em]">
        {title}
      </h1>
      <p className="text-sm leading-normal text-muted md:text-body">
        {description}
      </p>
    </div>
  );
}

function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-9">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
        {description}
      </p>
    </div>
  );
}

function Group({
  title,
  rows,
  className,
}: {
  title: string;
  rows: number;
  className?: string;
}) {
  return (
    <section className={cn("mb-9", className)}>
      <h2 className="mb-3 font-mono text-label tracking-wider text-muted uppercase">
        {title}
      </h2>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-surface border border-border md:rounded-none md:border-x-0 md:border-b-0"
      >
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex min-h-17 items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 md:grid md:grid-cols-[9.5rem_minmax(0,1fr)_1rem] md:gap-5 md:px-0 md:py-4.5"
          >
            <Skeleton className="h-4 w-28 flex-1 md:flex-none" />
            <Skeleton className="h-4 w-32 md:w-56" />
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}

function PreferenceRows({ title, rows }: { title: string; rows: number }) {
  return (
    <section className="flex flex-col gap-2 md:gap-0">
      <div className="flex items-center justify-between gap-2.5 px-1.5 md:border-b md:border-border-strong md:px-0 md:pb-2.5">
        <h2 className="font-mono text-micro tracking-wider text-muted uppercase md:text-label">
          {title}
        </h2>
      </div>
      <div
        aria-hidden="true"
        className="flex flex-col overflow-hidden rounded-surface border border-border bg-surface md:overflow-visible md:rounded-none md:border-0 md:bg-transparent"
      >
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid md:grid-cols-[13.75rem_minmax(0,1fr)] md:items-center md:gap-x-6 md:gap-y-2.5 md:px-0 md:py-4"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full max-w-md rounded-surface" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SettingsOverviewLoading() {
  return (
    <LoadingScope label="Chargement des réglages">
      <div aria-hidden="true" className="mb-5 flex items-center gap-4 md:mb-8">
        <Skeleton className="size-14 rounded-surface" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="hidden h-11 w-36 rounded-surface md:block" />
      </div>
      <div className="mb-6 flex flex-col gap-2 rounded-surface border border-border bg-surface p-4 md:mb-10 md:gap-4 md:px-6 md:py-5.5">
        <div className="flex items-center gap-2.5">
          <StrideMark className="hidden md:block" />
          <h2 className="text-sm font-semibold md:text-lg">
            <span className="md:hidden">Modèle d’athlète</span>
            <span className="hidden md:inline">Ton modèle d’athlète</span>
          </h2>
        </div>
        <p className="hidden max-w-160 text-sm leading-normal text-muted md:block">
          Garmin fournit les signaux. Stride en tire ton modèle, avec tes
          réponses, tes objectifs et ta façon de réagir à l’entraînement.
        </p>
        <Skeleton aria-hidden="true" className="h-2 w-full md:h-2.5" />
        <Skeleton aria-hidden="true" className="h-4 w-64 max-w-full" />
      </div>
      <Group title="Toi" rows={4} />
      <Group title="Données" rows={2} />
    </LoadingScope>
  );
}

export function SettingsProfileLoading() {
  return (
    <LoadingScope
      label="Chargement du profil"
      className="flex flex-col gap-5.5 min-[1100px]:gap-9"
    >
      <section className="flex flex-col gap-2 px-1 min-[1100px]:px-0">
        <h1 className="text-2xl font-semibold tracking-tight min-[1100px]:text-[32px]">
          Profil
        </h1>
        <p className="text-sm leading-relaxed text-muted min-[1100px]:text-body">
          Corrige ce que Garmin a mal relevé. Une valeur modifiée devient la
          tienne et n’est plus écrasée.
        </p>
        <div className="flex gap-3 pt-1 min-[1100px]:hidden">
          <ProvenanceLabel source="provider">Garmin</ProvenanceLabel>
          <ProvenanceLabel source="manual">Toi</ProvenanceLabel>
          <ProvenanceLabel source="estimate">Estimation Stride</ProvenanceLabel>
        </div>
      </section>
      {[
        { title: "Toi", rows: 5 },
        { title: "Issu de ton entraînement", rows: 4 },
      ].map((section) => (
        <section key={section.title} className="min-w-0">
          <h2 className="mb-2 w-full px-1.5 font-mono text-micro font-normal tracking-wider text-muted-foreground uppercase min-[1100px]:mb-0 min-[1100px]:border-b min-[1100px]:border-border-strong min-[1100px]:px-0 min-[1100px]:pb-2.5 min-[1100px]:text-label">
            {section.title}
          </h2>
          <div
            aria-hidden="true"
            className="overflow-hidden rounded-panel border border-border bg-surface min-[1100px]:rounded-none min-[1100px]:border-0 min-[1100px]:bg-transparent"
          >
            {Array.from({ length: section.rows }, (_, row) => (
              <div
                key={row}
                className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 min-[1100px]:grid min-[1100px]:grid-cols-[180px_320px_minmax(0,1fr)] min-[1100px]:gap-5 min-[1100px]:px-0 min-[1100px]:py-3.5 min-[1100px]:last:border-b"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-28 rounded-surface min-[1100px]:w-full" />
                <Skeleton className="hidden h-3 w-24 min-[1100px]:block" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </LoadingScope>
  );
}

export function SettingsTrainingLoading() {
  return (
    <LoadingScope
      label="Chargement de l’entraînement"
      className="flex flex-col gap-6 md:gap-10"
    >
      <PageTitle
        title="Entraînement et coach"
        description="Ça guide mes plans et ma façon de te parler. Changer tes disponibilités déclenchera une proposition de mise à jour, sans réécrire ta semaine en douce."
      />
      <div className="flex flex-col gap-6">
        <PreferenceRows title="Entraînement" rows={5} />
        <PreferenceRows title="Unités" rows={2} />
        <PreferenceRows title="Coach" rows={3} />
      </div>
    </LoadingScope>
  );
}

export function SettingsGoalsLoading() {
  return (
    <LoadingScope
      label="Chargement des objectifs"
      className="flex flex-col gap-6 md:gap-10"
    >
      <PageTitle
        title="Objectifs et courses"
        description="Ta course A structure tout le plan. La changer crée une proposition de plan que tu peux relire avant."
      />
      <section className="flex flex-col gap-2 md:gap-3">
        <h2 className={sectionTitle}>Objectif principal</h2>
        <Skeleton
          aria-hidden="true"
          className="h-36 w-full rounded-card md:h-20 md:rounded-surface"
        />
      </section>
      <section className="flex flex-col gap-2 md:gap-0">
        <div className="hidden gap-4 border-b border-border-strong pb-2.5 font-mono text-micro tracking-wider text-muted uppercase md:grid md:grid-cols-[2.75rem_minmax(0,1.6fr)_7.5rem_8.75rem_6.875rem_4.375rem]">
          <span>Prio</span>
          <span>À venir</span>
          <span>Date</span>
          <span>Distance</span>
          <span>Cible</span>
          <span />
        </div>
        <h2 className="px-1.5 font-mono text-micro tracking-wider text-muted uppercase md:hidden">
          À venir
        </h2>
        <div
          aria-hidden="true"
          className="flex flex-col overflow-hidden rounded-card border border-border bg-surface md:overflow-visible md:rounded-none md:border-0 md:bg-transparent"
        >
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 pr-2 pl-4 last:border-b-0 md:grid-cols-[2.75rem_minmax(0,1.6fr)_7.5rem_8.75rem_6.875rem_4.375rem] md:gap-4 md:py-4 md:pr-0 md:pl-0"
            >
              <Skeleton className="size-8 rounded-control" />
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="hidden h-5 w-16 md:block" />
              <Skeleton className="hidden h-5 w-16 md:block" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </section>
    </LoadingScope>
  );
}

export function SettingsConnectionsLoading() {
  return (
    <LoadingScope label="Chargement des connexions">
      <Heading
        title="Connexions"
        description="Garmin fournit les activités et les données de santé de ton historique."
      />
      <div className="mb-9 overflow-hidden rounded-surface border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-control border border-border-strong font-semibold">
            G
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            <h2 className="text-lg font-semibold">Garmin</h2>
            <Skeleton aria-hidden="true" className="h-4 w-32" />
          </div>
          <Skeleton aria-hidden="true" className="h-11 w-20 rounded-surface" />
        </div>
        <div className="grid grid-cols-2 border-t border-border md:grid-cols-3">
          {[
            { label: "Activités enregistrées", className: "" },
            { label: "Mesures de santé", className: "border-l border-border" },
            {
              label: "Dernière synchro",
              className:
                "col-span-2 border-t border-border md:col-span-1 md:border-t-0 md:border-l",
            },
          ].map((item) => (
            <div key={item.label} className={cn("p-5", item.className)}>
              <Skeleton aria-hidden="true" className="mb-1 h-7 w-16" />
              <span className="font-mono text-label text-muted uppercase">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <section className="mb-9">
        <h2 className="mb-3 font-mono text-label tracking-wider text-muted uppercase">
          Autres sources
        </h2>
        <div className="overflow-hidden rounded-surface border border-border md:rounded-none md:border-x-0 md:border-b-0">
          <div className="border-b border-border p-4 md:px-0">
            <strong className="text-sm">Autres montres et applications</strong>
            <p className="mt-1 text-sm text-muted">
              Les autres fournisseurs ne sont pas encore pris en charge.
            </p>
          </div>
          <div className="p-4 md:px-0">
            <strong className="text-sm">Saisie manuelle</strong>
            <p className="mt-1 text-sm text-muted">
              L’ajout de séances sans montre n’est pas encore disponible.
            </p>
          </div>
        </div>
      </section>
    </LoadingScope>
  );
}

export function SettingsGarminLoading() {
  return (
    <LoadingScope
      label="Chargement de Garmin"
      className="flex flex-col gap-6 md:gap-10"
    >
      <section className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <Skeleton aria-hidden="true" className="size-13 rounded-surface" />
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl leading-tight font-semibold tracking-tight">
              Garmin
            </h1>
            <Skeleton aria-hidden="true" className="h-4 w-56 max-w-full" />
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-48 rounded-surface" />
          <Skeleton className="h-11 w-32 rounded-surface" />
          <Skeleton className="h-11 w-32 rounded-surface" />
        </div>
      </section>
      <section
        aria-hidden="true"
        className="grid grid-cols-2 border-y border-border md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]"
      >
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex flex-col gap-1.5 py-4">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
        ))}
      </section>
      <section className="flex flex-col">
        <div className="border-b border-border-strong pb-2.5">
          <h2 className={columnTitle}>Données Garmin</h2>
        </div>
        <div aria-hidden="true" className="flex flex-col">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="border-b border-border py-4">
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-10 md:grid-cols-2">
        {["Ce que Stride peut faire", "Synchros récentes"].map((title) => (
          <section key={title} className="flex flex-col gap-3">
            <h2 className={columnTitle}>{title}</h2>
            <div
              aria-hidden="true"
              className="flex flex-col border-t border-border"
            >
              {[0, 1, 2].map((row) => (
                <div key={row} className="border-b border-border py-3.25">
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </LoadingScope>
  );
}

export function SettingsPrivacyLoading() {
  return (
    <LoadingScope label="Chargement des données et de la confidentialité">
      <Heading
        title="Données et confidentialité"
        description="Consulte les données enregistrées dans ton compte et télécharge une copie de tes réglages."
      />
      <section className="mb-9">
        <h2 className="mb-3 font-mono text-label tracking-wider text-muted uppercase">
          Enregistré dans Stride
        </h2>
        <div className="overflow-hidden rounded-surface border border-border md:rounded-none md:border-x-0 md:border-b-0">
          <div className="border-b border-border p-4 md:px-0">
            <strong className="text-sm">Activités et mesures Garmin</strong>
            <Skeleton
              aria-hidden="true"
              className="mt-1.5 h-4 w-80 max-w-full"
            />
          </div>
          <div className="p-4 md:px-0">
            <strong className="text-sm">
              Profil, entraînement, objectifs et courses
            </strong>
            <p className="mt-1 text-sm text-muted">
              Tes réponses restent disponibles dans ton compte après connexion.
            </p>
          </div>
        </div>
      </section>
      <Group title="Ta copie" rows={1} />
      <Skeleton aria-hidden="true" className="h-64 w-full rounded-surface" />
    </LoadingScope>
  );
}
